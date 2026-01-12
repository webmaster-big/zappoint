import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Plus,
  Download,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Mail,
  Phone,
  MapPin,
  Edit3,
  AlertCircle,
  RefreshCcw,
  Filter,
  DollarSign,
  Calendar,
  ShoppingBag,
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import LocationSelector from '../../../components/admin/LocationSelector';
import { contactService, type Contact, type ContactCreatePayload, type ContactUpdatePayload } from '../../../services/ContactService';
import { activityLogService } from '../../../services/ActivityLogService';
import { locationService } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';

interface EditingCell {
  id: number;
  field: string;
}

interface CreateCustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  notes: string;
}

const Customers: React.FC = () => {
  const { themeColor, fullColor } = useThemeColor();
  const user = getStoredUser();
  const isCompanyAdmin = user?.role === 'company_admin';

  // Page title
  useEffect(() => {
    document.title = 'Customers | Admin';
  }, []);

  // State
  const [customers, setCustomers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [perPage] = useState(15);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Inline editing state
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingCell, setSavingCell] = useState<EditingCell | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCustomerForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    notes: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string>('');

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stats for metrics
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalRevenue: 0,
    totalBookings: 0,
  });

  // Editable fields configuration
  const editableFields = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'city', label: 'City', type: 'text' },
    { key: 'state', label: 'State', type: 'text' },
    { key: 'zip', label: 'ZIP', type: 'text' },
    { key: 'country', label: 'Country', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'text' },
    { key: 'total_bookings', label: 'Bookings', type: 'number' },
    { key: 'total_purchases', label: 'Purchases', type: 'number' },
    { key: 'total_spent', label: 'Total Spent', type: 'number' },
  ];

  // Metrics for dashboard cards
  const metrics = [
    {
      title: 'Total Customers',
      value: stats.totalCustomers.toString(),
      change: `${stats.activeCustomers} active`,
      icon: Users,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Active Customers',
      value: stats.activeCustomers.toString(),
      change: 'Currently active',
      icon: Users,
      accent: 'bg-green-100 text-green-800',
    },
    {
      title: 'Total Bookings',
      value: stats.totalBookings.toString(),
      change: 'All time',
      icon: Calendar,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      change: 'Lifetime value',
      icon: DollarSign,
      accent: 'bg-green-100 text-green-800',
    },
  ];

  // Fetch locations
  useEffect(() => {
    if (isCompanyAdmin) {
      fetchLocations();
    }
  }, [isCompanyAdmin]);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await contactService.fetchContacts({
        page: currentPage,
        per_page: perPage,
        search: searchTerm || undefined,
        location_id: selectedLocation ? parseInt(selectedLocation) : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
      });

      if (response.success && response.data) {
        setCustomers(response.data.contacts);
        setTotalPages(response.data.pagination.last_page);
        setTotalCustomers(response.data.pagination.total);

        // Calculate stats from fetched data
        const contacts = response.data.contacts;
        const activeCount = contacts.filter(c => c.status === 'active').length;
        const totalSpent = contacts.reduce((sum, c) => sum + (c.total_spent || 0), 0);
        const totalBookingsCount = contacts.reduce((sum, c) => sum + (c.total_bookings || 0), 0);

        setStats({
          totalCustomers: response.data.pagination.total,
          activeCustomers: activeCount,
          totalRevenue: totalSpent,
          totalBookings: totalBookingsCount,
        });
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, perPage, searchTerm, selectedLocation, sortBy, sortOrder, statusFilter, sourceFilter]);

  // Fetch customers when filters change
  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const fetchLocations = async () => {
    try {
      const response = await locationService.getLocations();
      if (response.success && response.data) {
        setLocations(Array.isArray(response.data) ? response.data : []);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setSourceFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  // Handle inline edit start
  const startEditing = (customer: Contact, field: string) => {
    const value = customer[field as keyof Contact];
    setEditingCell({ id: customer.id, field });
    setEditValue(value?.toString() ?? '');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Handle inline edit save
  const saveEdit = async () => {
    if (!editingCell) return;

    const customer = customers.find(c => c.id === editingCell.id);
    if (!customer) return;

    const oldValue = customer[editingCell.field as keyof Contact];
    const oldValueStr = oldValue?.toString() ?? '';

    // Skip if no change
    if (editValue === oldValueStr) {
      setEditingCell(null);
      setEditValue('');
      return;
    }

    setSavingCell(editingCell);

    try {
      // Prepare update payload
      let updateValue: string | number | null = editValue;
      
      // Handle numeric fields
      if (['total_bookings', 'total_purchases', 'total_spent'].includes(editingCell.field)) {
        updateValue = editValue ? parseFloat(editValue) : 0;
      } else if (editValue === '') {
        updateValue = null;
      }

      const payload: ContactUpdatePayload = {
        [editingCell.field]: updateValue,
      };

      const response = await contactService.updateContact(editingCell.id, payload);

      if (response.success) {
        // Update local state
        setCustomers(prev =>
          prev.map(c =>
            c.id === editingCell.id ? { ...c, ...response.data } : c
          )
        );

        // Log activity
        await activityLogService.logCustomerUpdate(
          user?.id ?? null,
          editingCell.id,
          customer.name,
          editingCell.field,
          oldValueStr || null,
          editValue || null
        );
      }
    } catch (error) {
      console.error('Error updating customer:', error);
    } finally {
      setSavingCell(null);
      setEditingCell(null);
      setEditValue('');
    }
  };

  // Handle inline edit cancel
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Handle key down in edit input
  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Handle create customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateLoading(true);

    try {
      const payload: ContactCreatePayload = {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        phone: createForm.phone.trim() || null,
        address: createForm.address.trim() || null,
        city: createForm.city.trim() || null,
        state: createForm.state.trim() || null,
        zip: createForm.zip.trim() || null,
        country: createForm.country.trim() || null,
        notes: createForm.notes.trim() || null,
        source: 'manual',
        status: 'active',
        location_id: selectedLocation ? parseInt(selectedLocation) : null,
      };

      const response = await contactService.createContact(payload);

      if (response.success) {
        // Log activity
        await activityLogService.logCustomerCreate(
          user?.id ?? null,
          response.data.id,
          response.data.name,
          response.data.email
        );

        // Reset form and close modal
        setCreateForm({
          name: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          zip: '',
          country: '',
          notes: '',
        });
        setShowCreateModal(false);

        // Refresh customers
        fetchCustomers();
      }
    } catch (error: unknown) {
      console.error('Error creating customer:', error);
      const axiosError = error as { response?: { data?: { message?: string } } };
      setCreateError(axiosError.response?.data?.message || 'Failed to create customer');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle delete customer
  const handleDeleteCustomer = async (customer: Contact) => {
    setDeleting(true);
    try {
      const response = await contactService.deleteContact(customer.id);

      if (response.success) {
        // Log activity
        await activityLogService.logCustomerDelete(
          user?.id ?? null,
          customer.id,
          customer.name
        );

        // Refresh customers
        fetchCustomers();
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      const response = await contactService.exportContacts({
        search: searchTerm || undefined,
        location_id: selectedLocation ? parseInt(selectedLocation) : undefined,
        status: statusFilter || undefined,
        source: sourceFilter || undefined,
      });

      if (response.success && response.data) {
        const contacts = response.data.contacts;

        // Generate CSV
        const headers = ['Name', 'Email', 'Phone', 'Address', 'City', 'State', 'ZIP', 'Country', 'Source', 'Status', 'Total Bookings', 'Total Purchases', 'Total Spent', 'Notes'];
        const csvRows = [
          headers.join(','),
          ...contacts.map(c => [
            `"${c.name || ''}"`,
            `"${c.email || ''}"`,
            `"${c.phone || ''}"`,
            `"${c.address || ''}"`,
            `"${c.city || ''}"`,
            `"${c.state || ''}"`,
            `"${c.zip || ''}"`,
            `"${c.country || ''}"`,
            `"${c.source || ''}"`,
            `"${c.status || ''}"`,
            c.total_bookings || 0,
            c.total_purchases || 0,
            c.total_spent || 0,
            `"${(c.notes || '').replace(/"/g, '""')}"`,
          ].join(','))
        ];

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        // Log export activity
        await activityLogService.logCustomerExport(
          user?.id ?? null,
          contacts.length,
          { search: searchTerm, location: selectedLocation, status: statusFilter, source: sourceFilter }
        );
      }
    } catch (error) {
      console.error('Error exporting customers:', error);
    }
  };

  // Handle search with debounce
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  }, []);

  // Render editable cell
  const renderEditableCell = (customer: Contact, field: string, displayValue: React.ReactNode) => {
    const isEditing = editingCell?.id === customer.id && editingCell?.field === field;
    const isSaving = savingCell?.id === customer.id && savingCell?.field === field;
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
        className="group cursor-pointer flex items-center gap-1 hover:bg-gray-100 rounded px-1 py-0.5 -mx-1 min-h-[20px]"
        onClick={() => startEditing(customer, field)}
        title="Click to edit"
      >
        <span className="truncate text-xs">{displayValue || <span className="text-gray-400 italic">—</span>}</span>
        <Edit3 className="w-2.5 h-2.5 text-gray-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
      </div>
    );
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get source badge color
  const getSourceBadgeColor = (source: string) => {
    switch (source) {
      case 'booking':
        return `bg-${themeColor}-100 text-${fullColor}`;
      case 'attraction_purchase':
        return 'bg-purple-100 text-purple-800';
      case 'manual':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    return status === 'active'
      ? 'bg-green-100 text-green-800'
      : 'bg-red-100 text-red-800';
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-800 mt-2">Manage all customer contacts</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-0">
          {isCompanyAdmin && locations.length > 0 && (
            <LocationSelector
              variant="compact"
              locations={locations}
              selectedLocation={selectedLocation}
              onLocationChange={(id) => {
                setSelectedLocation(id);
                setCurrentPage(1);
              }}
              themeColor={themeColor}
              fullColor={fullColor}
              showAllOption={true}
            />
          )}
          <StandardButton
            variant="primary"
            size="md"
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            Add Customer
          </StandardButton>
          <StandardButton
            variant="primary"
            size="md"
            icon={Download}
            onClick={handleExport}
          >
            Export
          </StandardButton>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow min-h-[120px]"
            >
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}><Icon size={20} /></div>
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
              onChange={handleSearchChange}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton
              variant="secondary"
              size="sm"
              icon={Filter}
              onClick={() => setShowFilters(!showFilters)}
            >
              Filters
            </StandardButton>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={RefreshCcw}
              onClick={fetchCustomers}
            >
              {''}
            </StandardButton>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Source</label>
                <select
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="">All Sources</option>
                  <option value="booking">Booking</option>
                  <option value="attraction_purchase">Attraction Purchase</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Sort By</label>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [by, order] = e.target.value.split('-');
                    setSortBy(by);
                    setSortOrder(order as 'asc' | 'desc');
                    setCurrentPage(1);
                  }}
                  className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                >
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="total_spent-desc">Highest Spend</option>
                  <option value="total_spent-asc">Lowest Spend</option>
                  <option value="total_bookings-desc">Most Bookings</option>
                </select>
              </div>
              <div className="flex items-end">
                <StandardButton
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </StandardButton>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Customer</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Contact</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Source</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider text-center">Bookings</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider text-center">Purchases</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider text-right">Revenue</th>
                <th className="px-3 py-2.5 text-xs font-medium text-gray-600 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className={`animate-spin rounded-full h-6 w-6 border-b-2 border-${fullColor}`}></div>
                      <span className="ml-2">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-12 text-center text-gray-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                    <p className="font-medium">No customers found</p>
                    <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or add a new customer</p>
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    {/* Customer Name */}
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {renderEditableCell(customer, 'name', customer.name)}
                      </div>
                    </td>

                    {/* Contact Info */}
                    <td className="px-3 py-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {renderEditableCell(customer, 'email', customer.email)}
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                          {renderEditableCell(customer, 'phone', customer.phone || '')}
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="px-3 py-2">
                      {customer.location ? (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{customer.location.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>

                    {/* Source Badge */}
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded ${getSourceBadgeColor(customer.source)}`}>
                        {customer.source === 'booking' && <Calendar className="w-2.5 h-2.5" />}
                        {customer.source === 'attraction_purchase' && <ShoppingBag className="w-2.5 h-2.5" />}
                        {customer.source === 'manual' && <Users className="w-2.5 h-2.5" />}
                        {customer.source === 'attraction_purchase' ? 'Purchase' : customer.source}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded capitalize ${getStatusBadgeColor(customer.status)}`}>
                        {customer.status}
                      </span>
                    </td>

                    {/* Bookings (Editable) */}
                    <td className="px-3 py-2 text-center">
                      {renderEditableCell(customer, 'total_bookings', customer.total_bookings)}
                    </td>

                    {/* Purchases (Editable) */}
                    <td className="px-3 py-2 text-center">
                      {renderEditableCell(customer, 'total_purchases', customer.total_purchases)}
                    </td>

                    {/* Revenue (Editable) */}
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1 font-medium text-gray-900">
                        <DollarSign className={`w-3 h-3 text-${themeColor}-600`} />
                        {renderEditableCell(customer, 'total_spent', formatCurrency(customer.total_spent || 0).replace('$', ''))}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2 text-center">
                      {deleteConfirm === customer.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={deleting}
                            className="p-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                            title="Confirm delete"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            disabled={deleting}
                            className="p-1 text-gray-600 hover:text-gray-700 disabled:opacity-50"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(customer.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete customer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-600">
              Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              <span className="text-gray-400 ml-2">({totalCustomers} customers)</span>
            </div>
            <div className="flex items-center gap-1">
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </StandardButton>
              
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
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 text-sm rounded ${
                      currentPage === pageNum
                        ? `bg-${themeColor}-600 text-white`
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <StandardButton
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className={`flex items-center justify-between p-5 border-b border-gray-100 bg-${themeColor}-50`}>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add New Customer</h2>
                <p className="text-sm text-gray-600 mt-1">Create a manual customer entry</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateError('');
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-5 space-y-4">
              {createError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    required
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Full name"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    required
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Phone number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={createForm.country}
                    onChange={(e) => setCreateForm(f => ({ ...f, country: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Country"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm(f => ({ ...f, address: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={createForm.city}
                    onChange={(e) => setCreateForm(f => ({ ...f, city: e.target.value }))}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                    placeholder="City"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={createForm.state}
                      onChange={(e) => setCreateForm(f => ({ ...f, state: e.target.value }))}
                      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      placeholder="State"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                    <input
                      type="text"
                      value={createForm.zip}
                      onChange={(e) => setCreateForm(f => ({ ...f, zip: e.target.value }))}
                      className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      placeholder="ZIP"
                    />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={createForm.notes}
                    onChange={(e) => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className={`w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600 resize-none`}
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <StandardButton
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError('');
                  }}
                >
                  Cancel
                </StandardButton>
                <StandardButton
                  type="submit"
                  variant="primary"
                  size="md"
                  icon={createLoading ? undefined : Plus}
                  disabled={createLoading || !createForm.name.trim() || !createForm.email.trim()}
                >
                  {createLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    'Create Customer'
                  )}
                </StandardButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
       