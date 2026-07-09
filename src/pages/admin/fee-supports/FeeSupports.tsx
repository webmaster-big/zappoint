import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Pencil,
  Power,
  DollarSign,
  Percent,
  ArrowLeft,
  Download,
  CheckSquare,
  Square,
  Package as PackageIcon,
  Ticket,
  Layers,
  CreditCard
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { feeSupportService } from '../../../services/FeeSupportService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import { locationService } from '../../../services/LocationService';
import { eventCacheService } from '../../../services/EventCacheService';
import { membershipCache } from '../../../services/MembershipCacheService';
import { getStoredUser } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';
import type { FeeSupport, FeeSupportFormData } from '../../../types/FeeSupport.types';
import type { Package as PackageType } from '../../../services/PackageService';
import type { Attraction } from '../../../services/AttractionService';

const FeeSupports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();

  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const userLocationId = currentUser?.location_id || null;

  const entityTypeParam = searchParams.get('entity_type');
  const initialEntityType: 'package' | 'attraction' | 'event' | 'membership' | 'all' =
    entityTypeParam === 'package' || entityTypeParam === 'attraction' || entityTypeParam === 'event' || entityTypeParam === 'membership' ? entityTypeParam : 'all';

  const [feeSupports, setFeeSupports] = useState<FeeSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingFeeSupport, setEditingFeeSupport] = useState<FeeSupport | null>(null);
  const [saving, setSaving] = useState(false);

  const [packages, setPackages] = useState<Array<{ id: number; name: string }>>([]);
  const [attractions, setAttractions] = useState<Array<{ id: number; name: string }>>([]);
  const [events, setEvents] = useState<Array<{ id: number; name: string }>>([]);
  const [membershipPlans, setMembershipPlans] = useState<Array<{ id: number; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  const [form, setForm] = useState<FeeSupportFormData>({
    company_id: currentUser?.company_id || 1,
    location_id: null,
    fee_name: '',
    fee_amount: 0,
    fee_calculation_type: 'fixed',
    fee_application_type: 'additive',
    entity_ids: [],
    entity_type: initialEntityType !== 'all' ? initialEntityType : 'package',
    is_active: true,
  });

  const loadFeeSupports = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feeSupportService.getFeeSupports({
        per_page: 500,
        user_id: currentUser?.id,
      });
      if (response.success && response.data) {
        setFeeSupports(response.data.fee_supports || []);
      }
    } catch (error) {
      console.error('Error loading fee supports:', error);
      setToast({ message: 'Failed to load fee supports', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  const loadLocations = useCallback(async () => {
    try {
      const response = await locationService.getLocations();
      if (response.success && response.data) {
        const locs = Array.isArray(response.data) ? response.data : [];
        setLocations(locs.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })));
      }
    } catch {
      console.error('Failed to load locations');
    }
  }, []);

  const loadEntities = useCallback(async (entityType: 'package' | 'attraction' | 'event' | 'membership') => {
    setLoadingEntities(true);
    try {
      if (entityType === 'membership') {
        const plans = await membershipCache.getPlans();
        setMembershipPlans(plans.map((p) => ({ id: p.id, name: p.name })));
      } else if (entityType === 'package') {
        const cachedPackages = await packageCacheService.getCachedPackages();
        if (cachedPackages && cachedPackages.length > 0) {
          setPackages(cachedPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        } else {
          const freshPackages = await packageCacheService.getPackages({ user_id: currentUser?.id });
          setPackages(freshPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        }
      } else if (entityType === 'attraction') {
        const cachedAttractions = await attractionCacheService.getCachedAttractions();
        if (cachedAttractions && cachedAttractions.length > 0) {
          setAttractions(cachedAttractions.map((a: Attraction) => ({ id: a.id, name: a.name })));
        } else {
          const freshAttractions = await attractionCacheService.getAttractions({ user_id: currentUser?.id });
          setAttractions(freshAttractions.map((a: Attraction) => ({ id: a.id, name: a.name })));
        }
      } else if (entityType === 'event') {
        const cached = await eventCacheService.getCachedEvents();
        let eventList = cached || await eventCacheService.getEvents({ user_id: currentUser?.id });
        const today = new Date().toISOString().split('T')[0];
        const activeEvents = eventList.filter(ev => {
          if (ev.is_active === false) return false;
          const endDate = ev.end_date || ev.start_date;
          if (endDate && endDate < today) return false;
          return true;
        });
        setEvents(activeEvents.map(ev => ({ id: ev.id, name: ev.name })));
        if (cached) eventCacheService.syncInBackground({ user_id: currentUser?.id });
      }
    } catch {
      console.error('Failed to load entities');
    } finally {
      setLoadingEntities(false);
    }
  }, [currentUser?.id]);

  useEffect(() => { loadFeeSupports(); loadLocations(); }, [loadFeeSupports, loadLocations]);

  useEffect(() => {
    if (showModal) {
      loadEntities(form.entity_type);
    }
  }, [showModal, form.entity_type, loadEntities]);

  const formatFeeAmount = (fs: FeeSupport) => {
    if (fs.fee_calculation_type === 'percentage') return `${parseFloat(fs.fee_amount)}%`;
    return `$${parseFloat(fs.fee_amount).toFixed(2)}`;
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const entityTypeLabel = (t: FeeSupport['entity_type']) =>
    t === 'package' ? 'Package' : t === 'event' ? 'Event' : t === 'membership' ? 'Membership' : 'Attraction';

  const handleToggleStatus = async (id: number) => {
    try {
      await feeSupportService.toggleStatus(id);
      setFeeSupports(prev => prev.map(fs => fs.id === id ? { ...fs, is_active: !fs.is_active } : fs));
      setToast({ message: 'Status updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const columns: AdminColumn<FeeSupport>[] = [
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: fs => fs.id,
      exportValue: fs => fs.id,
      defaultVisible: false,
      render: fs => <span className="text-sm text-gray-500">#{fs.id}</span>,
    },
    {
      key: 'fee_name',
      label: 'Fee Name',
      group: 'Identifiers',
      sortable: true,
      sortValue: fs => fs.fee_name,
      exportValue: fs => fs.fee_name,
      lockVisible: true,
      render: fs => <span className="text-sm font-medium text-gray-900">{fs.fee_name}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      group: 'Fee Details',
      sortable: true,
      sortValue: fs => parseFloat(fs.fee_amount),
      exportValue: fs => formatFeeAmount(fs),
      render: fs => <span className="text-sm font-semibold text-gray-900">{formatFeeAmount(fs)}</span>,
    },
    {
      key: 'calculation',
      label: 'Calculation',
      group: 'Fee Details',
      sortable: true,
      sortValue: fs => fs.fee_calculation_type,
      exportValue: fs => (fs.fee_calculation_type === 'fixed' ? 'Fixed' : 'Percentage'),
      render: fs => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${themeColor}-100 text-${fullColor}`}>
          {fs.fee_calculation_type === 'fixed' ? <DollarSign className="w-3 h-3" /> : <Percent className="w-3 h-3" />}
          {fs.fee_calculation_type === 'fixed' ? 'Fixed' : 'Percentage'}
        </span>
      ),
    },
    {
      key: 'application',
      label: 'Application',
      group: 'Fee Details',
      sortable: true,
      sortValue: fs => fs.fee_application_type,
      exportValue: fs => (fs.fee_application_type === 'additive' ? 'Additive' : 'Inclusive'),
      render: fs => (
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${fs.fee_application_type === 'additive' ? `bg-${themeColor}-100 text-${fullColor}` : 'bg-gray-100 text-gray-600'}`}>
          {fs.fee_application_type === 'additive' ? 'Additive' : 'Inclusive'}
        </span>
      ),
    },
    {
      key: 'entity_type',
      label: 'Entity Type',
      group: 'Applies To',
      sortable: true,
      sortValue: fs => fs.entity_type,
      exportValue: fs => entityTypeLabel(fs.entity_type),
      render: fs => (
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${fs.entity_type === 'event' ? 'bg-amber-100 text-amber-800' : fs.entity_type === 'membership' ? 'bg-purple-100 text-purple-800' : `bg-${themeColor}-100 text-${fullColor}`}`}>
          {fs.entity_type === 'package' ? <PackageIcon className="w-3 h-3" /> : fs.entity_type === 'event' ? <Layers className="w-3 h-3" /> : fs.entity_type === 'membership' ? <CreditCard className="w-3 h-3" /> : <Ticket className="w-3 h-3" />}
          {entityTypeLabel(fs.entity_type)}
        </span>
      ),
    },
    {
      key: 'entities',
      label: 'Entities',
      group: 'Applies To',
      sortable: true,
      sortValue: fs => fs.entity_ids?.length || 0,
      exportValue: fs => fs.entity_ids?.length || 0,
      render: fs => <span className="text-xs text-gray-500">{fs.entity_ids?.length || 0} item(s)</span>,
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Location',
      sortable: true,
      sortValue: fs => fs.location?.name || 'All Locations',
      exportValue: fs => fs.location?.name || 'All Locations',
      render: fs => <span className="text-sm text-gray-600">{fs.location?.name || 'All Locations'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: fs => (fs.is_active ? 'Active' : 'Inactive'),
      exportValue: fs => (fs.is_active ? 'Active' : 'Inactive'),
      render: fs => (
        <button
          onClick={() => handleToggleStatus(fs.id)}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${fs.is_active ? `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
        >
          <Power className="w-3 h-3" />
          {fs.is_active ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: fs => new Date(fs.created_at || 0).getTime(),
      exportValue: fs => formatDateTime(fs.created_at),
      defaultVisible: false,
      render: fs => <span className="whitespace-nowrap text-sm text-gray-500">{formatDateTime(fs.created_at)}</span>,
    },
    {
      key: 'updated_at',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: fs => new Date(fs.updated_at || 0).getTime(),
      exportValue: fs => formatDateTime(fs.updated_at),
      defaultVisible: false,
      render: fs => <span className="whitespace-nowrap text-sm text-gray-500">{formatDateTime(fs.updated_at)}</span>,
    },
  ];

  const filterDefs: AdminFilterDef<FeeSupport>[] = useMemo(() => [
    {
      type: 'select',
      key: 'entity_type',
      label: 'Entity Type',
      allLabel: 'All Types',
      options: [
        { value: 'package', label: 'Package' },
        { value: 'attraction', label: 'Attraction' },
        { value: 'event', label: 'Event' },
        { value: 'membership', label: 'Membership' },
      ],
      predicate: (fs, value) => fs.entity_type === value,
    },
    {
      type: 'select',
      key: 'calculation',
      label: 'Calculation Type',
      allLabel: 'All Calculations',
      options: [
        { value: 'fixed', label: 'Fixed' },
        { value: 'percentage', label: 'Percentage' },
      ],
      predicate: (fs, value) => fs.fee_calculation_type === value,
    },
    {
      type: 'select',
      key: 'application',
      label: 'Application Type',
      allLabel: 'All Applications',
      options: [
        { value: 'additive', label: 'Additive' },
        { value: 'inclusive', label: 'Inclusive' },
      ],
      predicate: (fs, value) => fs.fee_application_type === value,
    },
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (fs, value) => (value === 'active' ? fs.is_active : !fs.is_active),
    },
    {
      type: 'select',
      key: 'location',
      label: 'Location',
      allLabel: 'All Locations',
      options: [
        { value: 'company-wide', label: 'Company-wide (All Locations)' },
        ...locations.map(l => ({ value: String(l.id), label: l.name })),
      ],
      predicate: (fs, value) => (value === 'company-wide' ? fs.location_id === null : String(fs.location_id) === value),
    },
    {
      type: 'daterange',
      key: 'created',
      label: 'Created Date',
      getDate: fs => fs.created_at,
    },
    {
      type: 'numberrange',
      key: 'amount',
      label: 'Fee Amount',
      getValue: fs => parseFloat(fs.fee_amount),
    },
  ], [locations]);

  const table = useAdminTable<FeeSupport>({
    data: feeSupports,
    columns,
    getRowId: fs => String(fs.id),
    storageKey: 'fee_supports',
    filterDefs,
    searchFields: fs => [
      fs.id,
      fs.fee_name,
      fs.location?.name || 'All Locations',
      fs.entity_type,
      fs.fee_calculation_type,
      fs.fee_application_type,
      formatFeeAmount(fs),
    ],
    defaultSort: (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    itemsPerPage: 10,
  });

  useEffect(() => {
    if (initialEntityType !== 'all') {
      table.setFilterValue('entity_type', initialEntityType);
    }
  }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this fee support?')) return;
    try {
      await feeSupportService.deleteFeeSupport(id);
      setFeeSupports(prev => prev.filter(fs => fs.id !== id));
      table.setSelectedIds(table.selectedIds.filter(x => x !== String(id)));
      setToast({ message: 'Fee support deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete fee support', type: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${table.selectedIds.length} fee support(s)?`)) return;
    const ids = table.selectedIds.map(Number);
    try {
      await feeSupportService.bulkDelete(ids);
      setFeeSupports(prev => prev.filter(fs => !ids.includes(fs.id)));
      table.clearSelection();
      setToast({ message: `${ids.length} fee support(s) deleted`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete fee supports', type: 'error' });
    }
  };

  const exportToCsv = () => {
    exportTableCsv({
      filename: `fee-supports-export-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Fee Amount (Raw)', value: fs => fs.fee_amount },
        { label: 'Entity IDs', value: fs => (fs.entity_ids || []).join('; ') },
        { label: 'Company', value: fs => fs.company?.name || fs.company_id },
        { label: 'Location ID', value: fs => fs.location_id ?? '' },
      ],
    });
  };

  const openCreateModal = () => {
    setEditingFeeSupport(null);
    setForm({
      company_id: currentUser?.company_id || 1,
      location_id: isCompanyAdmin ? null : userLocationId,
      fee_name: '',
      fee_amount: 0,
      fee_calculation_type: 'fixed',
      fee_application_type: 'additive',
      entity_ids: [],
      entity_type: initialEntityType !== 'all' ? initialEntityType : 'package',
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (fs: FeeSupport) => {
    setEditingFeeSupport(fs);
    setForm({
      company_id: fs.company_id,
      location_id: fs.location_id,
      fee_name: fs.fee_name,
      fee_amount: parseFloat(fs.fee_amount),
      fee_calculation_type: fs.fee_calculation_type,
      fee_application_type: fs.fee_application_type,
      entity_ids: fs.entity_ids || [],
      entity_type: fs.entity_type,
      is_active: fs.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingFeeSupport(null);
  };

  const handleFormChange = (field: keyof FeeSupportFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'entity_type') {
      setForm(prev => ({ ...prev, entity_ids: [] }));
    }
  };

  const toggleEntity = (entityId: number) => {
    setForm(prev => ({
      ...prev,
      entity_ids: prev.entity_ids.includes(entityId)
        ? prev.entity_ids.filter(id => id !== entityId)
        : [...prev.entity_ids, entityId],
    }));
  };

  const toggleSelectAllEntities = () => {
    const entityList = form.entity_type === 'package' ? packages
      : form.entity_type === 'event' ? events
      : form.entity_type === 'membership' ? membershipPlans
      : attractions;
    if (form.entity_ids.length === entityList.length) {
      setForm(prev => ({ ...prev, entity_ids: [] }));
    } else {
      setForm(prev => ({ ...prev, entity_ids: entityList.map(e => e.id) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.fee_name.trim()) {
      setToast({ message: 'Fee name is required', type: 'error' });
      return;
    }
    if (form.fee_amount <= 0) {
      setToast({ message: 'Fee amount must be greater than 0', type: 'error' });
      return;
    }
    if (form.fee_calculation_type === 'percentage' && form.fee_amount > 100) {
      setToast({ message: 'Percentage fee cannot exceed 100%', type: 'error' });
      return;
    }
    if (form.entity_ids.length === 0) {
      setToast({ message: 'Please select at least one entity', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      if (editingFeeSupport) {
        await feeSupportService.updateFeeSupport(editingFeeSupport.id, form);
        setToast({ message: 'Fee support updated successfully', type: 'success' });
      } else {
        await feeSupportService.createFeeSupport(form);
        setToast({ message: 'Fee support created successfully', type: 'success' });
      }
      closeModal();
      loadFeeSupports();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to save fee support';
      setToast({ message: errMsg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const samplePrice = 100;
  const previewFeeAmount = form.fee_calculation_type === 'percentage'
    ? samplePrice * (form.fee_amount / 100)
    : form.fee_amount;
  const previewTotal = form.fee_application_type === 'additive'
    ? samplePrice + previewFeeAmount
    : samplePrice;

  const totalActive = feeSupports.filter(fs => fs.is_active).length;
  const totalPackageFees = feeSupports.filter(fs => fs.entity_type === 'package').length;
  const totalAttractionFees = feeSupports.filter(fs => fs.entity_type === 'attraction').length;
  const totalEventFees = feeSupports.filter(fs => fs.entity_type === 'event').length;
  const totalMembershipFees = feeSupports.filter(fs => fs.entity_type === 'membership').length;

  const backPath = initialEntityType === 'package' ? '/packages' : initialEntityType === 'attraction' ? '/attractions' : initialEntityType === 'event' ? '/events' : null;

  const entities = form.entity_type === 'package' ? packages
    : form.entity_type === 'event' ? events
    : form.entity_type === 'membership' ? membershipPlans
    : attractions;
  const entityNoun = form.entity_type === 'package' ? 'Packages'
    : form.entity_type === 'event' ? 'Events'
    : form.entity_type === 'membership' ? 'Membership Plans'
    : 'Attractions';
  const entityNounLower = entityNoun.toLowerCase();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div className="flex items-center gap-3">
          {backPath && (
            <button onClick={() => navigate(backPath)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Fee Supports</h1>
            <p className="text-gray-600 mt-1">Manage additional fees for packages, attractions, events, and memberships</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <StandardButton variant="secondary" size="md" icon={Download} onClick={exportToCsv}>
            Export CSV
          </StandardButton>
          <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreateModal}>
            Create Fee
          </StandardButton>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {[
          { title: 'Total Fee Supports', value: feeSupports.length.toString(), sub: `${totalActive} active`, icon: DollarSign },
          { title: 'Package Fees', value: totalPackageFees.toString(), sub: 'Applied to packages', icon: PackageIcon },
          { title: 'Attraction Fees', value: totalAttractionFees.toString(), sub: 'Applied to attractions', icon: Ticket },
          { title: 'Event Fees', value: totalEventFees.toString(), sub: 'Applied to events', icon: Layers },
          { title: 'Membership Fees', value: totalMembershipFees.toString(), sub: 'Applied to memberships', icon: CreditCard },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-2 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-${themeColor}-100 text-${fullColor}`}><Icon size={20} /></div>
                <span className="text-base font-semibold text-gray-800">{m.title}</span>
              </div>
              <CounterAnimation value={m.value} className="text-2xl font-bold text-gray-900" />
              <p className="text-xs text-gray-600">{m.sub}</p>
            </div>
          );
        })}
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search fee supports..."
        onRefresh={loadFeeSupports}
      />

      <BulkActionsBar table={table} itemLabel="fee support(s)">
        <StandardButton variant="danger" size="sm" icon={Trash2} onClick={handleBulkDelete}>
          Delete Selected
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        loading={loading && feeSupports.length === 0}
        selectable
        itemLabel="fee supports"
        emptyState={(
          <div>
            <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No fee supports found</p>
          </div>
        )}
        rowClassName={fs => (table.selectedIds.includes(String(fs.id)) ? `bg-${themeColor}-50` : '')}
        renderActions={fs => (
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => openEditModal(fs)}
              className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`}
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(fs.id)}
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      />

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-${themeColor}-100 flex items-center justify-center flex-shrink-0`}>
                  <DollarSign className={`w-5 h-5 text-${fullColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingFeeSupport ? 'Edit Fee Support' : 'Create Fee Support'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingFeeSupport ? 'Modify an existing fee that applies to your bookings.' : 'Add a new fee that will be applied to selected packages or attractions.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fee_name}
                    onChange={(e) => handleFormChange('fee_name', e.target.value)}
                    placeholder="e.g., Processing Fee, Service Fee"
                    className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    required
                  />
                </div>

                {isCompanyAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                    <select
                      value={form.location_id || ''}
                      onChange={(e) => handleFormChange('location_id', e.target.value ? parseInt(e.target.value) : null)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="">All Locations (Company-wide)</option>
                      {locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <DollarSign className={`w-4 h-4 text-${fullColor}`} /> Fee Settings
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Define the fee amount and how it’s calculated.</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Calculation</label>
                      <select
                        value={form.fee_calculation_type}
                        onChange={(e) => handleFormChange('fee_calculation_type', e.target.value)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      >
                        <option value="fixed">Fixed ($)</option>
                        <option value="percentage">Percentage (%)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount {form.fee_calculation_type === 'percentage' ? '(%)' : '($)'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-medium">{form.fee_calculation_type === 'percentage' ? '%' : '$'}</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={form.fee_calculation_type === 'percentage' ? '100' : undefined}
                          value={form.fee_amount}
                          onChange={(e) => handleFormChange('fee_amount', parseFloat(e.target.value) || 0)}
                          className={`w-full pl-9 border border-gray-200 rounded-lg py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Application Type</label>
                    <select
                      value={form.fee_application_type}
                      onChange={(e) => handleFormChange('fee_application_type', e.target.value)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="additive">Additive (added on top)</option>
                      <option value="inclusive">Inclusive (included in price)</option>
                    </select>
                  </div>

                  <div className={`mt-3 bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3 text-sm`}>
                    <span className="text-gray-600">Preview ($100): </span>
                    <span className={`text-${fullColor} font-semibold`}>+${previewFeeAmount.toFixed(2)}</span>
                    <span className="text-gray-500 ml-2">= ${previewTotal.toFixed(2)} total</span>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Layers className={`w-4 h-4 text-${fullColor}`} /> Apply To
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Select which packages, attractions, events, or membership plans include this fee.</p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
                    <select
                      value={form.entity_type}
                      onChange={(e) => handleFormChange('entity_type', e.target.value)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="package">Packages</option>
                      <option value="attraction">Attractions</option>
                      <option value="event">Events</option>
                      <option value="membership">Membership Plans</option>
                    </select>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Select {entityNoun} <span className="text-red-500">*</span>
                      </label>
                      <button type="button" onClick={toggleSelectAllEntities} className={`text-xs text-${fullColor} hover:underline font-medium`}>
                        {form.entity_ids.length === entities.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    {loadingEntities ? (
                      <div className="flex items-center justify-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                        <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-${fullColor}`}></div>
                      </div>
                    ) : entities.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                        No {entityNounLower} found
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                        {entities.map(entity => (
                          <button
                            key={entity.id}
                            type="button"
                            onClick={() => toggleEntity(entity.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${form.entity_ids.includes(entity.id) ? `bg-${themeColor}-50` : ''}`}
                          >
                            {form.entity_ids.includes(entity.id) ? (
                              <CheckSquare className={`w-4 h-4 text-${fullColor}`} />
                            ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                            )}
                            <span className="text-sm text-gray-900">{entity.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {form.entity_ids.length > 0 && (
                      <p className={`mt-2 text-xs text-${fullColor} font-medium`}>{form.entity_ids.length} selected</p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-5">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => handleFormChange('is_active', e.target.checked)}
                      className={`h-4 w-4 text-${fullColor} focus:ring-${themeColor}-500 border-gray-300 rounded`}
                    />
                    <label className="ml-2 block text-sm text-gray-900">Active</label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <StandardButton type="button" variant="secondary" onClick={closeModal}>Cancel</StandardButton>
                  <StandardButton type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingFeeSupport ? 'Update' : 'Create')}
                  </StandardButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default FeeSupports;
