import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Mail,
  Phone,
  Building2,
  Trash2,
  Eye,
  Download,
  Tag,
  X,
  CheckSquare,
  MapPin,
  Edit3,
  Check,
  Briefcase,
  FileText,
  Plus,
  UserPlus,
  Save,
  UserCheck,
  UserX,
  Calendar,
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import { useThemeColor } from '../../../hooks/useThemeColor';
import contactService, {
  type Contact,
  type ContactFilters,
  type ContactStatistics
} from '../../../services/ContactService';
import { getStoredUser } from '../../../utils/storage';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

const CustomerListing: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [statistics, setStatistics] = useState<ContactStatistics | null>(null);
  const [bulkAction, setBulkAction] = useState<string>('');
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'active' | 'inactive'>('active');
  const [processingBulk, setProcessingBulk] = useState(false);
  const [exportFilters, setExportFilters] = useState({
    statuses: [] as string[],
    tags: [] as string[],
    activeOnly: false
  });

  const [editingCell, setEditingCell] = useState<{ contactId: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<{ contactId: number; field: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showAddTagModal, setShowAddTagModal] = useState(false);
  const [selectedContactForTag, setSelectedContactForTag] = useState<Contact | null>(null);
  const [newTag, setNewTag] = useState('');
  const [addingTag, setAddingTag] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedContactForView, setSelectedContactForView] = useState<Contact | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingContact, setCreatingContact] = useState(false);
  const [newContact, setNewContact] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    company_name: '',
    job_title: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
    source: '',
    tags: [] as string[],
    status: 'active' as 'active' | 'inactive'
  });
  const [viewEditMode, setViewEditMode] = useState(false);
  const [viewEditData, setViewEditData] = useState<Partial<Contact>>({});
  const [savingViewEdit, setSavingViewEdit] = useState(false);

  const editableFields = [
    { key: 'first_name', label: 'First Name', type: 'text', apiField: 'first_name' },
    { key: 'last_name', label: 'Last Name', type: 'text', apiField: 'last_name' },
    { key: 'email', label: 'Email', type: 'email', apiField: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel', apiField: 'phone' },
    { key: 'company_name', label: 'Company', type: 'text', apiField: 'company_name' },
    { key: 'job_title', label: 'Job Title', type: 'text', apiField: 'job_title' },
    { key: 'address', label: 'Address', type: 'text', apiField: 'address' },
    { key: 'city', label: 'City', type: 'text', apiField: 'city' },
    { key: 'state', label: 'State', type: 'text', apiField: 'state' },
    { key: 'zip', label: 'ZIP', type: 'text', apiField: 'zip' },
    { key: 'country', label: 'Country', type: 'text', apiField: 'country' },
    { key: 'notes', label: 'Notes', type: 'text', apiField: 'notes' },
  ];

  const loadContacts = useCallback(async () => {
    if (!currentUser?.company_id) return;

    try {
      setLoading(true);

      const baseFilters: ContactFilters = {
        company_id: currentUser.company_id,
        per_page: 200,
        sort_by: 'created_at',
        sort_order: 'desc',
      };

      if (currentUser.location_id) {
        baseFilters.location_id = currentUser.location_id;
      }

      let allContacts: Contact[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await contactService.getContacts({ ...baseFilters, page });
        if (!response.success || !response.data) break;
        allContacts = allContacts.concat(response.data.contacts);
        lastPage = response.data.pagination.last_page;
        page++;
      } while (page <= lastPage);

      setContacts(allContacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [currentUser?.company_id, currentUser?.location_id]);

  const fetchTags = useCallback(async () => {
    if (!currentUser?.company_id) return;

    try {
      const response = await contactService.getTags({ company_id: currentUser.company_id });
      if (response.success) {
        setAvailableTags(response.data);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  }, [currentUser?.company_id]);

  const fetchStatistics = useCallback(async () => {
    if (!currentUser?.company_id) return;

    try {
      const response = await contactService.getStatistics({ company_id: currentUser.company_id });
      if (response.success) {
        setStatistics(response.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  }, [currentUser?.company_id]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    fetchTags();
    fetchStatistics();
  }, [fetchTags, fetchStatistics]);

  const handleExport = async () => {
    if (!currentUser?.company_id) return;

    try {
      setExporting(true);

      const response = await contactService.exportForCampaign({
        company_id: currentUser.company_id,
        location_id: currentUser.location_id,
        tags: exportFilters.tags.length > 0 ? exportFilters.tags : undefined,
        status: exportFilters.statuses.length === 1 ? exportFilters.statuses[0] as 'active' | 'inactive' : undefined,
        active_only: exportFilters.activeOnly || undefined
      });

      if (response.success && response.data) {
        const csvData = convertToCSV(response.data.contacts);

        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers-export-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setShowExportModal(false);
        setExportFilters({
          statuses: [],
          tags: [],
          activeOnly: false
        });
      }
    } catch (error) {
      console.error('Error exporting contacts:', error);
      alert('Failed to export customers. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;

    try {
      const response = await contactService.deleteContact(contactId);
      if (response.success) {
        loadContacts();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete customer. Please try again.');
    }
  };

  const convertToCSV = (rows: Array<{ id: number; email: string; name: string; first_name: string | null; last_name: string | null; variables: Record<string, string> }>): string => {
    const headers = [
      'ID',
      'Name',
      'Email',
      'First Name',
      'Last Name'
    ];

    const csvRows = rows.map(contact => [
      contact.id,
      contact.name,
      contact.email,
      contact.first_name || '',
      contact.last_name || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  const startEditing = (contactId: number, field: string, currentValue: string | number | null) => {
    setEditingCell({ contactId, field });
    setEditValue(String(currentValue ?? ''));
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const contact = contacts.find(c => c.id === editingCell.contactId);
    if (!contact) return;

    const fieldConfig = editableFields.find(f => f.key === editingCell.field);
    if (!fieldConfig) return;

    const oldValue = contact[editingCell.field as keyof Contact];
    const oldValueStr = String(oldValue ?? '');

    if (editValue === oldValueStr) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    setSavingCell(editingCell);

    try {
      const updateValue = editValue === '' ? null : editValue;

      const response = await contactService.updateContact(editingCell.contactId, {
        [fieldConfig.apiField]: updateValue,
      });

      if (response.success) {
        setContacts(prev =>
          prev.map(c => {
            if (c.id === editingCell.contactId) {
              return { ...c, [editingCell.field]: updateValue };
            }
            return c;
          })
        );
      }
    } catch (error) {
      console.error('Error updating contact:', error);
      alert('Failed to update customer. Please try again.');
    } finally {
      setSavingCell(null);
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleAddTag = async () => {
    if (!selectedContactForTag || !newTag.trim()) return;

    setAddingTag(true);
    try {
      const response = await contactService.addTag(selectedContactForTag.id, newTag.trim());
      if (response.success) {
        setContacts(prev =>
          prev.map(c => {
            if (c.id === selectedContactForTag.id) {
              const currentTags = c.tags || [];
              return { ...c, tags: [...currentTags, newTag.trim()] };
            }
            return c;
          })
        );
        setNewTag('');
        setShowAddTagModal(false);
        setSelectedContactForTag(null);
        fetchTags();
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Failed to add tag. Please try again.');
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemoveTag = async (contactId: number, tag: string) => {
    try {
      const response = await contactService.removeTag(contactId, tag);
      if (response.success) {
        setContacts(prev =>
          prev.map(c => {
            if (c.id === contactId) {
              return { ...c, tags: (c.tags || []).filter(t => t !== tag) };
            }
            return c;
          })
        );
      }
    } catch (error) {
      console.error('Error removing tag:', error);
      alert('Failed to remove tag. Please try again.');
    }
  };

  const handleToggleStatus = async (contact: Contact) => {
    const newStatus = contact.status === 'active' ? 'inactive' : 'active';
    try {
      const response = await contactService.updateContact(contact.id, { status: newStatus });
      if (response.success) {
        setContacts(prev =>
          prev.map(c => c.id === contact.id ? { ...c, status: newStatus } : c)
        );
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Failed to update status. Please try again.');
    }
  };

  const handleCreateContact = async () => {
    if (!currentUser?.company_id || !newContact.email.trim()) return;

    setCreatingContact(true);
    try {
      const response = await contactService.createContact({
        company_id: currentUser.company_id,
        location_id: currentUser.location_id,
        ...newContact,
        email: newContact.email.trim(),
        first_name: newContact.first_name.trim() || undefined,
        last_name: newContact.last_name.trim() || undefined,
        phone: newContact.phone.trim() || undefined,
        date_of_birth: newContact.date_of_birth || undefined,
        company_name: newContact.company_name.trim() || undefined,
        job_title: newContact.job_title.trim() || undefined,
        address: newContact.address.trim() || undefined,
        city: newContact.city.trim() || undefined,
        state: newContact.state.trim() || undefined,
        zip: newContact.zip.trim() || undefined,
        country: newContact.country.trim() || undefined,
        notes: newContact.notes.trim() || undefined,
        source: newContact.source.trim() || undefined,
        tags: newContact.tags.length > 0 ? newContact.tags : undefined,
      });

      if (response.success) {
        setShowCreateModal(false);
        setNewContact({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          date_of_birth: '',
          company_name: '',
          job_title: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          notes: '',
          source: '',
          tags: [],
          status: 'active'
        });
        loadContacts();
        fetchStatistics();
        fetchTags();
      }
    } catch (error) {
      console.error('Error creating contact:', error);
      alert('Failed to create customer. Please try again.');
    } finally {
      setCreatingContact(false);
    }
  };

  const startViewEdit = () => {
    if (!selectedContactForView) return;
    setViewEditData({
      first_name: selectedContactForView.first_name || '',
      last_name: selectedContactForView.last_name || '',
      email: selectedContactForView.email,
      phone: selectedContactForView.phone || '',
      date_of_birth: selectedContactForView.date_of_birth ? selectedContactForView.date_of_birth.substring(0, 10) : '',
      company_name: selectedContactForView.company_name || '',
      job_title: selectedContactForView.job_title || '',
      address: selectedContactForView.address || '',
      city: selectedContactForView.city || '',
      state: selectedContactForView.state || '',
      zip: selectedContactForView.zip || '',
      country: selectedContactForView.country || '',
      notes: selectedContactForView.notes || '',
      source: selectedContactForView.source || '',
      status: selectedContactForView.status,
    });
    setViewEditMode(true);
  };

  const saveViewEdit = async () => {
    if (!selectedContactForView) return;

    setSavingViewEdit(true);
    try {
      const updateData: Record<string, string | undefined> = {};
      if (viewEditData.first_name !== undefined) updateData.first_name = viewEditData.first_name || undefined;
      if (viewEditData.last_name !== undefined) updateData.last_name = viewEditData.last_name || undefined;
      if (viewEditData.email !== undefined) updateData.email = viewEditData.email;
      if (viewEditData.phone !== undefined) updateData.phone = viewEditData.phone || undefined;
      if (viewEditData.date_of_birth !== undefined) updateData.date_of_birth = viewEditData.date_of_birth || undefined;
      if (viewEditData.company_name !== undefined) updateData.company_name = viewEditData.company_name || undefined;
      if (viewEditData.job_title !== undefined) updateData.job_title = viewEditData.job_title || undefined;
      if (viewEditData.address !== undefined) updateData.address = viewEditData.address || undefined;
      if (viewEditData.city !== undefined) updateData.city = viewEditData.city || undefined;
      if (viewEditData.state !== undefined) updateData.state = viewEditData.state || undefined;
      if (viewEditData.zip !== undefined) updateData.zip = viewEditData.zip || undefined;
      if (viewEditData.country !== undefined) updateData.country = viewEditData.country || undefined;
      if (viewEditData.notes !== undefined) updateData.notes = viewEditData.notes || undefined;
      if (viewEditData.source !== undefined) updateData.source = viewEditData.source || undefined;
      if (viewEditData.status !== undefined) updateData.status = viewEditData.status;

      const response = await contactService.updateContact(selectedContactForView.id, updateData);
      if (response.success) {
        const updatedContact = { ...selectedContactForView, ...viewEditData };
        setContacts(prev => prev.map(c => c.id === selectedContactForView.id ? updatedContact : c));
        setSelectedContactForView(updatedContact);
        setViewEditMode(false);
        setViewEditData({});
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSavingViewEdit(false);
    }
  };

  const cancelViewEdit = () => {
    setViewEditMode(false);
    setViewEditData({});
  };

  const renderEditableCell = (
    contact: Contact,
    field: string,
    displayValue: React.ReactNode,
    className: string = ''
  ) => {
    const isEditing = editingCell?.contactId === contact.id && editingCell?.field === field;
    const isSaving = savingCell?.contactId === contact.id && savingCell?.field === field;
    const fieldConfig = editableFields.find(f => f.key === field);

    if (isEditing) {
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type={fieldConfig?.type || 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleEditKeyDown}
            className={`w-full px-1.5 py-0.5 text-xs border border-${themeColor}-400 rounded bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-${themeColor}-500`}
            disabled={isSaving}
            autoFocus
          />
          <button
            onClick={(e) => { e.stopPropagation(); saveEdit(); }}
            className="p-0.5 text-green-600 hover:text-green-700"
            disabled={isSaving}
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); cancelEdit(); }}
            className="p-0.5 text-red-600 hover:text-red-700"
            disabled={isSaving}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 min-h-[20px] ${className}`}
        onClick={() => startEditing(contact.id, field, contact[field as keyof Contact] as string | number | null)}
        title="Click to edit"
      >
        <span className="truncate">{displayValue || <span className="text-gray-400 italic">—</span>}</span>
        <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </div>
    );
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'Active' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: 'Inactive' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getContactName = (contact: Contact): string => {
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    return name || contact.email || 'Unknown';
  };

  const formatDateTime = (value: string): string => {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const columns: AdminColumn<Contact>[] = [
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: c => c.id,
      exportValue: c => c.id,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => <span className="text-sm text-gray-900">#{c.id}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      group: 'Customer',
      sortable: true,
      sortValue: c => `${c.first_name || ''} ${c.last_name || ''}`.trim().toLowerCase(),
      exportValue: c => getContactName(c),
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm">
            {renderEditableCell(c, 'first_name', c.first_name, 'font-medium text-gray-900')}
          </div>
          <div className="flex items-center gap-2 text-sm">
            {renderEditableCell(c, 'last_name', c.last_name, 'text-gray-600')}
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      group: 'Customer',
      sortable: true,
      sortValue: c => c.email || '',
      exportValue: c => c.email,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="flex items-center gap-1.5 text-sm">
          <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {renderEditableCell(c, 'email', c.email, 'text-gray-600 max-w-[180px]')}
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      group: 'Customer',
      sortable: true,
      sortValue: c => c.phone || '',
      exportValue: c => c.phone,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="flex items-center gap-1.5 text-sm">
          <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {renderEditableCell(c, 'phone', c.phone, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      group: 'Work',
      sortable: true,
      sortValue: c => c.company_name || '',
      exportValue: c => c.company_name,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {renderEditableCell(c, 'company_name', c.company_name, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'jobTitle',
      label: 'Job Title',
      group: 'Work',
      sortable: true,
      sortValue: c => c.job_title || '',
      exportValue: c => c.job_title,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="flex items-center gap-1.5 text-sm">
          <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          {renderEditableCell(c, 'job_title', c.job_title, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Details',
      sortable: true,
      sortValue: c => c.location?.name || '',
      exportValue: c => c.location?.name || '',
      cellClassName: 'whitespace-nowrap',
      render: c => c.location ? (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span className="truncate">{c.location.name}</span>
        </div>
      ) : (
        <span className="text-sm text-gray-400 italic">—</span>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      group: 'Details',
      sortable: true,
      sortValue: c => (c.tags || []).join(', '),
      exportValue: c => (c.tags || []).join('; '),
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="flex flex-wrap gap-1 max-w-[150px]">
          {c.tags && c.tags.length > 0 ? (
            <>
              {c.tags.slice(0, 2).map((tag, idx) => (
                <span
                  key={idx}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200 group cursor-pointer`}
                  title="Click to remove"
                  onClick={() => handleRemoveTag(c.id, tag)}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                  <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                </span>
              ))}
              {c.tags.length > 2 && (
                <span className="text-xs text-gray-500">+{c.tags.length - 2}</span>
              )}
            </>
          ) : null}
          <button
            onClick={() => {
              setSelectedContactForTag(c);
              setShowAddTagModal(true);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100 border border-dashed border-gray-300"
            title="Add tag"
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      group: 'Details',
      sortable: true,
      sortValue: c => c.source || '',
      exportValue: c => c.source,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <span className="text-sm text-gray-600">
          {c.source || <span className="text-gray-400 italic">—</span>}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: c => c.status,
      exportValue: c => c.status,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <button
          onClick={() => handleToggleStatus(c)}
          title={`Click to ${c.status === 'active' ? 'deactivate' : 'activate'}`}
        >
          <StatusBadge status={c.status} />
        </button>
      ),
    },
    {
      key: 'sms',
      label: 'SMS',
      group: 'Status',
      sortable: true,
      sortValue: c => (c.sms_consent ? 1 : 0),
      exportValue: c => (c.sms_consent ? 'Opted In' : 'No'),
      cellClassName: 'whitespace-nowrap',
      render: c => c.sms_consent ? (
        <span className="text-green-600 font-medium text-xs">Opted In</span>
      ) : (
        <span className="text-gray-400 text-xs">No</span>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      group: 'Address',
      sortable: true,
      sortValue: c => c.address || '',
      exportValue: c => c.address,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'address', c.address, 'text-gray-600 max-w-[180px]')}
        </div>
      ),
    },
    {
      key: 'city',
      label: 'City',
      group: 'Address',
      sortable: true,
      sortValue: c => c.city || '',
      exportValue: c => c.city,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'city', c.city, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'state',
      label: 'State',
      group: 'Address',
      sortable: true,
      sortValue: c => c.state || '',
      exportValue: c => c.state,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'state', c.state, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'zip',
      label: 'ZIP',
      group: 'Address',
      sortable: true,
      sortValue: c => c.zip || '',
      exportValue: c => c.zip,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'zip', c.zip, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'country',
      label: 'Country',
      group: 'Address',
      sortable: true,
      sortValue: c => c.country || '',
      exportValue: c => c.country,
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'country', c.country, 'text-gray-600')}
        </div>
      ),
    },
    {
      key: 'notes',
      label: 'Notes',
      group: 'Details',
      sortable: true,
      sortValue: c => c.notes || '',
      exportValue: c => c.notes,
      defaultVisible: false,
      render: c => (
        <div className="text-sm">
          {renderEditableCell(c, 'notes', c.notes, 'text-gray-600 max-w-[200px]')}
        </div>
      ),
    },
    {
      key: 'created',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: c => new Date(c.created_at || 0).getTime(),
      exportValue: c => (c.created_at ? new Date(c.created_at).toLocaleString() : ''),
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => <span className="text-sm text-gray-500">{formatDateTime(c.created_at)}</span>,
    },
    {
      key: 'updated',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: c => new Date(c.updated_at || 0).getTime(),
      exportValue: c => (c.updated_at ? new Date(c.updated_at).toLocaleString() : ''),
      defaultVisible: false,
      cellClassName: 'whitespace-nowrap',
      render: c => <span className="text-sm text-gray-500">{formatDateTime(c.updated_at)}</span>,
    },
  ];

  const tagOptions = useMemo(
    () => availableTags.map(tag => ({ value: tag, label: tag })),
    [availableTags]
  );

  const sourceOptions = useMemo(() => {
    const unique = [...new Set(contacts.map(c => c.source).filter((s): s is string => !!s))].sort();
    return unique.map(source => ({ value: source, label: source }));
  }, [contacts]);

  const companyOptions = useMemo(() => {
    const unique = [...new Set(contacts.map(c => c.company_name).filter((s): s is string => !!s))].sort();
    return unique.map(name => ({ value: name, label: name }));
  }, [contacts]);

  const filterDefs: AdminFilterDef<Contact>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (c, value) => c.status === value,
    },
    {
      type: 'select',
      key: 'tag',
      label: 'Tag',
      allLabel: 'All Tags',
      options: tagOptions,
      predicate: (c, value) => (c.tags || []).includes(value),
    },
    {
      type: 'select',
      key: 'source',
      label: 'Source',
      allLabel: 'All Sources',
      options: sourceOptions,
      predicate: (c, value) => c.source === value,
    },
    {
      type: 'select',
      key: 'company',
      label: 'Company',
      allLabel: 'All Companies',
      options: companyOptions,
      predicate: (c, value) => c.company_name === value,
    },
    {
      type: 'select',
      key: 'sms',
      label: 'SMS Consent',
      allLabel: 'All SMS Consent',
      options: [
        { value: 'opted_in', label: 'Opted In' },
        { value: 'not_opted_in', label: 'Not Opted In' },
      ],
      predicate: (c, value) => (value === 'opted_in' ? c.sms_consent : !c.sms_consent),
    },
    {
      type: 'daterange',
      key: 'created',
      label: 'Created Date',
      getDate: c => c.created_at,
    },
  ], [tagOptions, sourceOptions, companyOptions]);

  const table = useAdminTable<Contact>({
    data: contacts,
    columns,
    getRowId: c => String(c.id),
    storageKey: 'customers',
    filterDefs,
    searchFields: c => [
      c.id,
      c.first_name,
      c.last_name,
      c.email,
      c.phone,
      c.company_name,
      c.job_title,
      c.source,
      (c.tags || []).join(' '),
      c.location?.name,
    ],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage: 10,
  });

  const handleBulkAction = async () => {
    const ids = table.selectedIds.map(Number);
    if (!ids.length || !bulkAction) return;

    try {
      setProcessingBulk(true);

      let response;
      switch (bulkAction) {
        case 'add_tags':
          response = await contactService.bulkUpdate({
            ids,
            action: 'add_tags',
            tags: bulkTags
          });
          break;
        case 'remove_tags':
          response = await contactService.bulkUpdate({
            ids,
            action: 'remove_tags',
            tags: bulkTags
          });
          break;
        case 'set_status':
          response = await contactService.bulkUpdate({
            ids,
            action: 'set_status',
            status: bulkStatus
          });
          break;
        case 'delete':
          response = await contactService.bulkDelete(ids);
          break;
        default:
          return;
      }

      if (response?.success) {
        table.clearSelection();
        setBulkAction('');
        setBulkTags([]);
        setShowBulkActionsModal(false);
        loadContacts();
        fetchTags();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
      alert('Failed to perform bulk action. Please try again.');
    } finally {
      setProcessingBulk(false);
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `customers-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'First Name', value: c => c.first_name || '' },
        { label: 'Last Name', value: c => c.last_name || '' },
      ],
    });
  };

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  const metrics = [
    {
      icon: Users,
      title: 'Total Customers',
      value: contacts.length,
      change: 'All registered customers',
      accentColor: themeColor,
    },
    {
      icon: UserCheck,
      title: 'Active',
      value: statistics?.active || 0,
      change: 'Currently active',
      accentColor: 'green',
    },
    {
      icon: UserX,
      title: 'Inactive',
      value: statistics?.inactive || 0,
      change: 'Currently inactive',
      accentColor: 'red',
    },
    {
      icon: Calendar,
      title: 'Recently Added',
      value: statistics?.recently_added || 0,
      change: 'New customers',
      accentColor: 'blue',
    },
  ];

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">
            Manage and view all customer contacts
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0 flex-wrap">
          {table.selectedIds.length > 0 && (
            <StandardButton
              variant="secondary"
              size="md"
              onClick={() => setShowBulkActionsModal(true)}
              icon={CheckSquare}
            >
              Bulk Actions ({table.selectedIds.length})
            </StandardButton>
          )}
          <StandardButton
            variant="secondary"
            size="md"
            onClick={exportToCSV}
            icon={Download}
          >
            Export CSV
          </StandardButton>
          <StandardButton
            variant="secondary"
            size="md"
            onClick={() => setShowExportModal(true)}
            icon={Download}
          >
            Campaign Export
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            onClick={() => setShowCreateModal(true)}
            icon={UserPlus}
          >
            Add Customer
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-${metric.accentColor}-100 text-${metric.accentColor}-600`}><Icon size={20} /></div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-600">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search customers..."
        onRefresh={() => {
          loadContacts();
          fetchStatistics();
          fetchTags();
        }}
      />

      <BulkActionsBar table={table} itemLabel="customer(s)">
        <StandardButton
          variant="secondary"
          size="sm"
          icon={CheckSquare}
          onClick={() => setShowBulkActionsModal(true)}
        >
          Bulk Actions
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        loading={loading && contacts.length === 0}
        selectable
        itemLabel="customers"
        emptyState={
          <div className="flex flex-col items-center justify-center">
            <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
              <Users className={`h-12 w-12 text-${themeColor}-400`} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-500 text-sm">
              {table.searchInput || table.activeFilterCount > 0
                ? 'Try adjusting your search or filters'
                : 'No customers have been added yet'}
            </p>
          </div>
        }
        renderActions={(contact) => (
          <div className="flex items-center gap-1">
            <button
              className={`p-1 text-${themeColor}-600 hover:text-${fullColor}`}
              title="View Details"
              onClick={() => {
                setSelectedContactForView(contact);
                setShowViewModal(true);
              }}
            >
              <Eye className="h-4 w-4" />
            </button>
            <StandardButton
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => handleDeleteContact(contact.id)}
            >
              {''}
            </StandardButton>
          </div>
        )}
      />

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50 sticky top-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Export Customers</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure filters to export customer data
                  </p>
                </div>
                <StandardButton
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowExportModal(false);
                    setExportFilters({
                      statuses: [],
                      tags: [],
                      activeOnly: false
                    });
                  }}
                  icon={X}
                />
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  {['active', 'inactive'].map(status => (
                    <label key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportFilters.statuses.includes(status)}
                        onChange={(e) => {
                          setExportFilters(prev => ({
                            ...prev,
                            statuses: e.target.checked
                              ? [...prev.statuses, status]
                              : prev.statuses.filter(s => s !== status)
                          }));
                        }}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                      />
                      <span className="text-sm text-gray-700 capitalize">{status}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Filter by Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <label key={tag} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exportFilters.tags.includes(tag)}
                        onChange={(e) => {
                          setExportFilters(prev => ({
                            ...prev,
                            tags: e.target.checked
                              ? [...prev.tags, tag]
                              : prev.tags.filter(t => t !== tag)
                          }));
                        }}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                      />
                      <span className="text-sm text-gray-700">{tag}</span>
                    </label>
                  ))}
                  {availableTags.length === 0 && (
                    <p className="text-sm text-gray-500">No tags available</p>
                  )}
                </div>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={exportFilters.activeOnly}
                    onChange={(e) => setExportFilters(prev => ({ ...prev, activeOnly: e.target.checked }))}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-2`}
                  />
                  <span className="text-sm text-gray-700">Export only active (opted-in) customers</span>
                </label>
              </div>

              <div className={`bg-${themeColor}-50 border-2 border-${themeColor}-200 rounded-lg p-4`}>
                <div className="flex items-start gap-3">
                  <Download className={`h-5 w-5 text-${fullColor} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-sm font-medium text-${fullColor}`}>
                      CSV Export Format
                    </p>
                    <p className="text-xs text-gray-700 mt-1">
                      Your data will be exported in CSV format including customer ID, name, email, first name, and last name.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowExportModal(false);
                  setExportFilters({
                    statuses: [],
                    tags: [],
                    activeOnly: false
                  });
                }}
                disabled={exporting}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="md"
                onClick={handleExport}
                disabled={exporting}
                icon={exporting ? undefined : Download}
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Exporting...
                  </>
                ) : (
                  'Export to CSV'
                )}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showBulkActionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Bulk Actions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Apply action to {table.selectedIds.length} selected customer{table.selectedIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <StandardButton
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowBulkActionsModal(false);
                    setBulkAction('');
                    setBulkTags([]);
                  }}
                  icon={X}
                />
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Action</label>
                <select
                  value={bulkAction}
                  onChange={(e) => setBulkAction(e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="">Choose an action...</option>
                  <option value="add_tags">Add Tags</option>
                  <option value="remove_tags">Remove Tags</option>
                  <option value="set_status">Change Status</option>
                  <option value="delete">Delete Selected</option>
                </select>
              </div>

              {(bulkAction === 'add_tags' || bulkAction === 'remove_tags') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Tags</label>
                  <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg max-h-32 overflow-y-auto">
                    {availableTags.map(tag => (
                      <label key={tag} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={bulkTags.includes(tag)}
                          onChange={(e) => {
                            setBulkTags(prev =>
                              e.target.checked
                                ? [...prev, tag]
                                : prev.filter(t => t !== tag)
                            );
                          }}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500 mr-1`}
                        />
                        <span className="text-sm text-gray-700">{tag}</span>
                      </label>
                    ))}
                    {availableTags.length === 0 && (
                      <p className="text-sm text-gray-500">No tags available</p>
                    )}
                  </div>
                </div>
              )}

              {bulkAction === 'set_status' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Status</label>
                  <select
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value as 'active' | 'inactive')}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              )}

              {bulkAction === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    <strong>Warning:</strong> This action will permanently delete {table.selectedIds.length} customer{table.selectedIds.length !== 1 ? 's' : ''}. This cannot be undone.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowBulkActionsModal(false);
                  setBulkAction('');
                  setBulkTags([]);
                }}
                disabled={processingBulk}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant={bulkAction === 'delete' ? 'danger' : 'primary'}
                size="md"
                onClick={handleBulkAction}
                disabled={!bulkAction || processingBulk || ((bulkAction === 'add_tags' || bulkAction === 'remove_tags') && bulkTags.length === 0)}
              >
                {processingBulk ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Processing...
                  </>
                ) : (
                  bulkAction === 'delete' ? 'Delete Customers' : 'Apply Action'
                )}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50 sticky top-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Add New Customer</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Create a new customer contact
                  </p>
                </div>
                <StandardButton
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewContact({
                      first_name: '',
                      last_name: '',
                      email: '',
                      phone: '',
                      date_of_birth: '',
                      company_name: '',
                      job_title: '',
                      address: '',
                      city: '',
                      state: '',
                      zip: '',
                      country: '',
                      notes: '',
                      source: '',
                      tags: [],
                      status: 'active'
                    });
                  }}
                  icon={X}
                />
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" /> Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">First Name</label>
                      <input
                        type="text"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Last Name</label>
                      <input
                        type="text"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="Last name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="email@example.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      <input
                        type="tel"
                        value={newContact.phone}
                        onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Date of Birth</label>
                      <input
                        type="date"
                        value={newContact.date_of_birth}
                        onChange={(e) => setNewContact(prev => ({ ...prev, date_of_birth: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4" /> Work Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Company</label>
                      <input
                        type="text"
                        value={newContact.company_name}
                        onChange={(e) => setNewContact(prev => ({ ...prev, company_name: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="Company name"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Job Title</label>
                      <input
                        type="text"
                        value={newContact.job_title}
                        onChange={(e) => setNewContact(prev => ({ ...prev, job_title: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="Job title"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Source</label>
                      <input
                        type="text"
                        value={newContact.source}
                        onChange={(e) => setNewContact(prev => ({ ...prev, source: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="e.g., Website, Referral, Event"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Status</label>
                      <select
                        value={newContact.status}
                        onChange={(e) => setNewContact(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-500">Street Address</label>
                      <input
                        type="text"
                        value={newContact.address}
                        onChange={(e) => setNewContact(prev => ({ ...prev, address: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="123 Main St"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">City</label>
                      <input
                        type="text"
                        value={newContact.city}
                        onChange={(e) => setNewContact(prev => ({ ...prev, city: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">State</label>
                      <input
                        type="text"
                        value={newContact.state}
                        onChange={(e) => setNewContact(prev => ({ ...prev, state: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="State"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">ZIP Code</label>
                      <input
                        type="text"
                        value={newContact.zip}
                        onChange={(e) => setNewContact(prev => ({ ...prev, zip: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="12345"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Country</label>
                      <input
                        type="text"
                        value={newContact.country}
                        onChange={(e) => setNewContact(prev => ({ ...prev, country: e.target.value }))}
                        className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        placeholder="Country"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="w-4 h-4" /> Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {newContact.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                        <button
                          onClick={() => setNewContact(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
                          className="ml-1 hover:text-red-500"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  {availableTags.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Add existing tags:</p>
                      <div className="flex flex-wrap gap-1">
                        {availableTags.filter(t => !newContact.tags.includes(t)).map(tag => (
                          <button
                            key={tag}
                            onClick={() => setNewContact(prev => ({ ...prev, tags: [...prev.tags, tag] }))}
                            className={`px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-${themeColor}-100 hover:text-${themeColor}-700`}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Notes
                  </h3>
                  <textarea
                    value={newContact.notes}
                    onChange={(e) => setNewContact(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Add notes about this customer..."
                  />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewContact({
                    first_name: '',
                    last_name: '',
                    email: '',
                    phone: '',
                    date_of_birth: '',
                    company_name: '',
                    job_title: '',
                    address: '',
                    city: '',
                    state: '',
                    zip: '',
                    country: '',
                    notes: '',
                    source: '',
                    tags: [],
                    status: 'active'
                  });
                }}
                disabled={creatingContact}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="md"
                onClick={handleCreateContact}
                disabled={!newContact.email.trim() || creatingContact}
                icon={creatingContact ? undefined : UserPlus}
              >
                {creatingContact ? 'Creating...' : 'Create Customer'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showAddTagModal && selectedContactForTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className={`p-4 border-b border-gray-100 bg-${themeColor}-50`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Add Tag</h2>
                  <p className="text-sm text-gray-600">
                    Add tag to {getContactName(selectedContactForTag)}
                  </p>
                </div>
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddTagModal(false);
                    setSelectedContactForTag(null);
                    setNewTag('');
                  }}
                  icon={X}
                />
              </div>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tag Name</label>
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                placeholder="Enter tag name..."
                className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                autoFocus
              />
              {availableTags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Existing tags (click to add):</p>
                  <div className="flex flex-wrap gap-1">
                    {availableTags.filter(t => !(selectedContactForTag.tags || []).includes(t)).map(tag => (
                      <button
                        key={tag}
                        onClick={() => setNewTag(tag)}
                        className={`px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600 hover:bg-${themeColor}-100 hover:text-${themeColor}-700`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end">
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setShowAddTagModal(false);
                  setSelectedContactForTag(null);
                  setNewTag('');
                }}
                disabled={addingTag}
              >
                Cancel
              </StandardButton>
              <StandardButton
                variant="primary"
                size="sm"
                onClick={handleAddTag}
                disabled={!newTag.trim() || addingTag}
              >
                {addingTag ? 'Adding...' : 'Add Tag'}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showViewModal && selectedContactForView && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50 sticky top-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Customer Details</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {getContactName(selectedContactForView)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!viewEditMode && (
                    <StandardButton
                      variant="secondary"
                      size="sm"
                      onClick={startViewEdit}
                      icon={Edit3}
                    >
                      Edit
                    </StandardButton>
                  )}
                  <StandardButton
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      setShowViewModal(false);
                      setSelectedContactForView(null);
                      setViewEditMode(false);
                      setViewEditData({});
                    }}
                    icon={X}
                  />
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="w-4 h-4" /> Personal Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">First Name</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.first_name || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, first_name: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.first_name || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Last Name</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.last_name || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, last_name: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.last_name || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Email</label>
                      {viewEditMode ? (
                        <input
                          type="email"
                          value={viewEditData.email || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, email: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.email}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Phone</label>
                      {viewEditMode ? (
                        <input
                          type="tel"
                          value={viewEditData.phone || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, phone: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.phone || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Date of Birth</label>
                      {viewEditMode ? (
                        <input
                          type="date"
                          value={viewEditData.date_of_birth || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, date_of_birth: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.date_of_birth ? selectedContactForView.date_of_birth.substring(0, 10) : '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">SMS Consent</label>
                      <p className="text-sm text-gray-900">
                        {selectedContactForView.sms_consent ? (
                          <span className="text-green-600 font-medium">Opted In</span>
                        ) : (
                          <span className="text-gray-500">Not Opted In</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Briefcase className="w-4 h-4" /> Work Information
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Company</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.company_name || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, company_name: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.company_name || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Job Title</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.job_title || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, job_title: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.job_title || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Source</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.source || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, source: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.source || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Status</label>
                      {viewEditMode ? (
                        <select
                          value={viewEditData.status || 'active'}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, status: e.target.value as 'active' | 'inactive' }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      ) : (
                        <div className="mt-1">
                          <StatusBadge status={selectedContactForView.status} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Address
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Street Address</label>
                      {viewEditMode ? (
                        <input
                          type="text"
                          value={viewEditData.address || ''}
                          onChange={(e) => setViewEditData(prev => ({ ...prev, address: e.target.value }))}
                          className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      ) : (
                        <p className="text-sm text-gray-900">{selectedContactForView.address || '—'}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">City</label>
                        {viewEditMode ? (
                          <input
                            type="text"
                            value={viewEditData.city || ''}
                            onChange={(e) => setViewEditData(prev => ({ ...prev, city: e.target.value }))}
                            className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{selectedContactForView.city || '—'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">State</label>
                        {viewEditMode ? (
                          <input
                            type="text"
                            value={viewEditData.state || ''}
                            onChange={(e) => setViewEditData(prev => ({ ...prev, state: e.target.value }))}
                            className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{selectedContactForView.state || '—'}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">ZIP</label>
                        {viewEditMode ? (
                          <input
                            type="text"
                            value={viewEditData.zip || ''}
                            onChange={(e) => setViewEditData(prev => ({ ...prev, zip: e.target.value }))}
                            className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{selectedContactForView.zip || '—'}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Country</label>
                        {viewEditMode ? (
                          <input
                            type="text"
                            value={viewEditData.country || ''}
                            onChange={(e) => setViewEditData(prev => ({ ...prev, country: e.target.value }))}
                            className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                          />
                        ) : (
                          <p className="text-sm text-gray-900">{selectedContactForView.country || '—'}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Additional Info
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500">Location</label>
                      <p className="text-sm text-gray-900">{selectedContactForView.location?.name || '—'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Created</label>
                      <p className="text-sm text-gray-900">{new Date(selectedContactForView.created_at).toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Last Updated</label>
                      <p className="text-sm text-gray-900">{new Date(selectedContactForView.updated_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4" /> Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedContactForView.tags && selectedContactForView.tags.length > 0 ? (
                    selectedContactForView.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No tags</p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4" /> Notes
                </h3>
                {viewEditMode ? (
                  <textarea
                    value={viewEditData.notes || ''}
                    onChange={(e) => setViewEditData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={4}
                    className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Add notes..."
                  />
                ) : (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedContactForView.notes || '—'}</p>
                )}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
              {viewEditMode ? (
                <>
                  <StandardButton
                    variant="secondary"
                    size="md"
                    onClick={cancelViewEdit}
                    disabled={savingViewEdit}
                  >
                    Cancel
                  </StandardButton>
                  <StandardButton
                    variant="primary"
                    size="md"
                    onClick={saveViewEdit}
                    disabled={savingViewEdit}
                    icon={savingViewEdit ? undefined : Save}
                  >
                    {savingViewEdit ? 'Saving...' : 'Save Changes'}
                  </StandardButton>
                </>
              ) : (
                <StandardButton
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowViewModal(false);
                    setSelectedContactForView(null);
                  }}
                >
                  Close
                </StandardButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerListing;
