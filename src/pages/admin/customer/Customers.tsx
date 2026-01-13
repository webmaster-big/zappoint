import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  Filter,
  Mail,
  Phone,
  Building2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Download,
  Tag,
  X,
  RefreshCcw,
  CheckSquare,
  MapPin,
  Edit3,
  Check,
  Briefcase,
  FileText,
  Plus,
  UserPlus,
  Save,
} from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import { useThemeColor } from '../../../hooks/useThemeColor';
import contactService, { 
  type Contact, 
  type ContactFilters, 
  type ContactStatistics 
} from '../../../services/ContactService';
import { getStoredUser } from '../../../utils/storage';

const CustomerListing: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [totalContacts, setTotalContacts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const currentUser = getStoredUser();
  const [showFilters, setShowFilters] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
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

  // Inline editing state
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

  // Editable fields configuration
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

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch contacts from API
  const fetchContacts = useCallback(async (_forceRefresh: boolean = false) => {
    if (!currentUser?.company_id) return;
    
    try {
      setLoading(true);
      
      const filters: ContactFilters = {
        company_id: currentUser.company_id,
        page: currentPage,
        per_page: itemsPerPage,
        search: debouncedSearchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter as 'active' | 'inactive' : undefined,
        tag: tagFilter || undefined,
        source: sourceFilter || undefined,
        sort_by: sortBy as ContactFilters['sort_by'],
        sort_order: sortOrder,
      };

      // Add location filter if user has a specific location
      if (currentUser.location_id) {
        filters.location_id = currentUser.location_id;
      }

      const response = await contactService.getContacts(filters);
      
      if (response.success && response.data) {
        setContacts(response.data.contacts);
        setTotalContacts(response.data.pagination.total);
        setTotalPages(response.data.pagination.last_page);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.company_id, currentUser?.location_id, currentPage, itemsPerPage, debouncedSearchTerm, statusFilter, tagFilter, sourceFilter, sortBy, sortOrder]);

  // Fetch available tags
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

  // Fetch statistics
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

  // Initialize contacts
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Fetch tags and statistics on mount
  useEffect(() => {
    fetchTags();
    fetchStatistics();
  }, [fetchTags, fetchStatistics]);

  // Export functionality
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
        // Convert to CSV
        const csvData = convertToCSV(response.data.contacts);
        
        // Download CSV
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

  // Bulk actions handler
  const handleBulkAction = async () => {
    if (!selectedContacts.length || !bulkAction) return;
    
    try {
      setProcessingBulk(true);
      
      let response;
      switch (bulkAction) {
        case 'add_tags':
          response = await contactService.bulkUpdate({
            ids: selectedContacts,
            action: 'add_tags',
            tags: bulkTags
          });
          break;
        case 'remove_tags':
          response = await contactService.bulkUpdate({
            ids: selectedContacts,
            action: 'remove_tags',
            tags: bulkTags
          });
          break;
        case 'set_status':
          response = await contactService.bulkUpdate({
            ids: selectedContacts,
            action: 'set_status',
            status: bulkStatus
          });
          break;
        case 'delete':
          response = await contactService.bulkDelete(selectedContacts);
          break;
        default:
          return;
      }
      
      if (response?.success) {
        setSelectedContacts([]);
        setBulkAction('');
        setBulkTags([]);
        setShowBulkActionsModal(false);
        fetchContacts();
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

  // Delete single contact
  const handleDeleteContact = async (contactId: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    
    try {
      const response = await contactService.deleteContact(contactId);
      if (response.success) {
        fetchContacts();
        fetchStatistics();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete customer. Please try again.');
    }
  };

  const convertToCSV = (contacts: Array<{ id: number; email: string; name: string; first_name: string | null; last_name: string | null; variables: Record<string, string> }>): string => {
    const headers = [
      'ID',
      'Name',
      'Email',
      'First Name',
      'Last Name'
    ];
    
    const rows = contacts.map(contact => [
      contact.id,
      contact.name,
      contact.email,
      contact.first_name || '',
      contact.last_name || ''
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    return csvContent;
  };

  // Toggle contact selection
  const toggleContactSelection = (contactId: number) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  // Select all contacts
  const toggleSelectAll = () => {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map(c => c.id));
    }
  };

  // Inline editing functions
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

    // Skip if no change
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
        // Update local state
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

  // Add tag to single contact
  const handleAddTag = async () => {
    if (!selectedContactForTag || !newTag.trim()) return;
    
    setAddingTag(true);
    try {
      const response = await contactService.addTag(selectedContactForTag.id, newTag.trim());
      if (response.success) {
        // Update local state
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
        fetchTags(); // Refresh available tags
      }
    } catch (error) {
      console.error('Error adding tag:', error);
      alert('Failed to add tag. Please try again.');
    } finally {
      setAddingTag(false);
    }
  };

  // Remove tag from single contact
  const handleRemoveTag = async (contactId: number, tag: string) => {
    try {
      const response = await contactService.removeTag(contactId, tag);
      if (response.success) {
        // Update local state
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

  // Toggle contact status
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

  // Create new contact
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
        fetchContacts();
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

  // Start editing in view modal
  const startViewEdit = () => {
    if (!selectedContactForView) return;
    setViewEditData({
      first_name: selectedContactForView.first_name || '',
      last_name: selectedContactForView.last_name || '',
      email: selectedContactForView.email,
      phone: selectedContactForView.phone || '',
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

  // Save view edit
  const saveViewEdit = async () => {
    if (!selectedContactForView) return;
    
    setSavingViewEdit(true);
    try {
      // Build update data with only defined string values
      const updateData: Record<string, string | undefined> = {};
      if (viewEditData.first_name !== undefined) updateData.first_name = viewEditData.first_name || undefined;
      if (viewEditData.last_name !== undefined) updateData.last_name = viewEditData.last_name || undefined;
      if (viewEditData.email !== undefined) updateData.email = viewEditData.email;
      if (viewEditData.phone !== undefined) updateData.phone = viewEditData.phone || undefined;
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
        // Update local state
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

  // Cancel view edit
  const cancelViewEdit = () => {
    setViewEditMode(false);
    setViewEditData({});
  };

  // Render editable cell
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

  // Pagination calculations
  const startIndex = (currentPage - 1) * itemsPerPage;

  // Handle page change
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    // Fetch will trigger automatically via useEffect
  };

  // Status badge component
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

  // Get contact display name
  const getContactName = (contact: Contact): string => {
    const name = `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    return name || contact.email || 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-2">
            Manage and view all customer contacts
            {statistics && (
              <span className="ml-2 text-sm">
                ({statistics.active} active, {statistics.inactive} inactive)
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 mt-4 sm:mt-0">
          {selectedContacts.length > 0 && (
            <StandardButton 
              variant="secondary"
              size="md"
              onClick={() => setShowBulkActionsModal(true)}
              icon={CheckSquare}
            >
              Bulk Actions ({selectedContacts.length})
            </StandardButton>
          )}
          <StandardButton 
            variant="secondary"
            size="md"
            onClick={() => setShowExportModal(true)}
            icon={Download}
          >
            Export
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

      {/* Filters and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              icon={Filter}
            >
              Filters
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              onClick={() => fetchContacts(true)}
              icon={RefreshCcw}
            >
              {''}
            </StandardButton>
          </div>
        </div>
        
        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Tag</label>
                <select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="">All Tags</option>
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Items Per Page</label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="5">5 per page</option>
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [column, order] = e.target.value.split('-');
                    setSortBy(column);
                    setSortOrder(order as 'asc' | 'desc');
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="first_name-asc">Name (A-Z)</option>
                  <option value="first_name-desc">Name (Z-A)</option>
                  <option value="email-asc">Email (A-Z)</option>
                  <option value="email-desc">Email (Z-A)</option>
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="company_name-asc">Company (A-Z)</option>
                  <option value="company_name-desc">Company (Z-A)</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setTagFilter('');
                  setSourceFilter('');
                  setSearchTerm('');
                  setSortBy('created_at');
                  setSortOrder('desc');
                }}
              >
                Clear Filters
              </StandardButton>
            </div>
          </div>
        )}
        
        {/* Results count */}
        <div className="text-sm text-gray-500 mt-3">
          Showing {totalContacts > 0 ? startIndex + 1 : 0}-{Math.min(startIndex + itemsPerPage, totalContacts)} of {totalContacts} customer{totalContacts !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={selectedContacts.length === contacts.length && contacts.length > 0}
                    onChange={toggleSelectAll}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                  />
                </th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Phone</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Company</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Job Title</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tags</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-3 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className={`inline-flex p-4 rounded-full bg-${themeColor}-50 mb-4`}>
                        <Users className={`h-12 w-12 text-${themeColor}-400`} />
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
                      <p className="text-gray-500 text-sm">
                        {searchTerm || statusFilter !== 'all' || tagFilter
                          ? 'Try adjusting your search or filters' 
                          : 'No customers have been added yet'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedContacts.includes(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-500`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm">
                          {renderEditableCell(contact, 'first_name', contact.first_name, 'font-medium text-gray-900')}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {renderEditableCell(contact, 'last_name', contact.last_name, 'text-gray-600')}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {renderEditableCell(contact, 'email', contact.email, 'text-gray-600 max-w-[180px]')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {renderEditableCell(contact, 'phone', contact.phone, 'text-gray-600')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {renderEditableCell(contact, 'company_name', contact.company_name, 'text-gray-600')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Briefcase className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        {renderEditableCell(contact, 'job_title', contact.job_title, 'text-gray-600')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {contact.location ? (
                        <div className="flex items-center gap-1.5 text-sm text-gray-600">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{contact.location.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[150px]">
                        {contact.tags && contact.tags.length > 0 ? (
                          <>
                            {contact.tags.slice(0, 2).map((tag, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200 group cursor-pointer`}
                                title="Click to remove"
                                onClick={() => handleRemoveTag(contact.id, tag)}
                              >
                                <Tag className="w-2.5 h-2.5" />
                                {tag}
                                <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />
                              </span>
                            ))}
                            {contact.tags.length > 2 && (
                              <span className="text-xs text-gray-500">+{contact.tags.length - 2}</span>
                            )}
                          </>
                        ) : null}
                        <button
                          onClick={() => {
                            setSelectedContactForTag(contact);
                            setShowAddTagModal(true);
                          }}
                          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs text-gray-500 hover:bg-gray-100 border border-dashed border-gray-300`}
                          title="Add tag"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <button
                        onClick={() => handleToggleStatus(contact)}
                        title={`Click to ${contact.status === 'active' ? 'deactivate' : 'activate'}`}
                      >
                        <StatusBadge status={contact.status} />
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button 
                          className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                          onClick={() => {
                            setSelectedContactForView(contact);
                            setShowViewModal(true);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Customer"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalContacts > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                icon={ChevronLeft}
              />

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <StandardButton
                    key={pageNum}
                    variant={currentPage === pageNum ? "primary" : "secondary"}
                    size="md"
                    onClick={() => goToPage(pageNum)}
                  >
                    {pageNum}
                  </StandardButton>
                );
              })}

              <StandardButton
                variant="secondary"
                size="md"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                icon={ChevronRight}
              />
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
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
              {/* Status Filter */}
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

              {/* Tags Filter */}
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

              {/* Active Only */}
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

              {/* Export Info */}
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

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className={`p-6 border-b border-gray-100 bg-${themeColor}-50`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Bulk Actions</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Apply action to {selectedContacts.length} selected customer{selectedContacts.length !== 1 ? 's' : ''}
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
              {/* Action Type */}
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

              {/* Tags Selection */}
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

              {/* Status Selection */}
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

              {/* Delete Warning */}
              {bulkAction === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">
                    <strong>Warning:</strong> This action will permanently delete {selectedContacts.length} customer{selectedContacts.length !== 1 ? 's' : ''}. This cannot be undone.
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

      {/* Create Customer Modal */}
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
                {/* Personal Info */}
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
                  </div>
                </div>

                {/* Work Info */}
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

                {/* Address Info */}
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

                {/* Tags */}
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

                {/* Notes */}
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

      {/* Add Tag Modal */}
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

      {/* View Contact Modal - Editable */}
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
                {/* Personal Info */}
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
                  </div>
                </div>

                {/* Work Info */}
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

                {/* Address Info */}
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

                {/* Additional Info */}
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

              {/* Tags */}
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

              {/* Notes */}
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