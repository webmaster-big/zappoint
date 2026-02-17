import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Trash2,
  Pencil,
  Power,
  DollarSign,
  Percent,
  ArrowLeft,
  RefreshCcw,
  CheckSquare,
  Square,
  Package as PackageIcon,
  Ticket,
  Calendar,
  Repeat,
  Tag,
  Layers,
  Settings
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { specialPricingService } from '../../../services/SpecialPricingService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import { locationService } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type {
  SpecialPricing,
  SpecialPricingListFilters,
  SpecialPricingFormData,
  RecurrenceType,
} from '../../../types/SpecialPricing.types';
import type { Package as PackageType } from '../../../services/PackageService';
import type { Attraction } from '../../../services/AttractionService';

const DAY_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const getOrdinalSuffix = (n: number): string => {
  if ([11, 12, 13].includes(n % 100)) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
};

const SpecialPricings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  
  // Check if user is company admin (can select locations)
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  // For non-company admins, auto-use their location_id
  const userLocationId = currentUser?.location_id || null;

  // Pre-filter entity_type from URL query param
  const entityTypeParam = searchParams.get('entity_type');
  const initialEntityType: 'package' | 'attraction' | 'all' =
    entityTypeParam === 'package' || entityTypeParam === 'attraction' ? entityTypeParam : 'all';

  const [specialPricings, setSpecialPricings] = useState<SpecialPricing[]>([]);
  const [filteredSpecialPricings, setFilteredSpecialPricings] = useState<SpecialPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingSpecialPricing, setEditingSpecialPricing] = useState<SpecialPricing | null>(null);
  const [saving, setSaving] = useState(false);

  // Entity data for the modal
  const [packages, setPackages] = useState<Array<{ id: number; name: string }>>([]);
  const [attractions, setAttractions] = useState<Array<{ id: number; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Form state
  const [form, setForm] = useState<SpecialPricingFormData>({
    company_id: currentUser?.company_id || 1,
    location_id: null,
    name: '',
    description: '',
    discount_amount: 10,
    discount_type: 'percentage',
    recurrence_type: 'weekly',
    recurrence_value: 2, // Tuesday by default
    specific_date: null,
    start_date: null,
    end_date: null,
    time_start: null,
    time_end: null,
    entity_type: initialEntityType !== 'all' ? initialEntityType : 'all',
    entity_ids: [],
    priority: 0,
    is_stackable: false,
    is_active: true,
  });

  const [filters, setFilters] = useState<SpecialPricingListFilters>({
    entity_type: initialEntityType,
    recurrence_type: 'all',
    discount_type: 'all',
    status: 'all',
    search: '',
  });

  // Load special pricings
  const loadSpecialPricings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await specialPricingService.getSpecialPricings({
        per_page: 500,
        user_id: currentUser?.id,
      });
      if (response.success && response.data) {
        setSpecialPricings(response.data.special_pricings || []);
      }
    } catch (error) {
      console.error('Error loading special pricings:', error);
      setToast({ message: 'Failed to load special pricings', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Load locations
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

  // Load entities using cache services
  const loadEntities = useCallback(async (entityType: 'package' | 'attraction' | 'all') => {
    setLoadingEntities(true);
    try {
      if (entityType === 'package' || entityType === 'all') {
        const cachedPackages = await packageCacheService.getCachedPackages();
        if (cachedPackages && cachedPackages.length > 0) {
          setPackages(cachedPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        } else {
          const freshPackages = await packageCacheService.getPackages({ user_id: currentUser?.id });
          setPackages(freshPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        }
      }
      if (entityType === 'attraction' || entityType === 'all') {
        const cachedAttractions = await attractionCacheService.getCachedAttractions();
        if (cachedAttractions && cachedAttractions.length > 0) {
          setAttractions(cachedAttractions.map((a: Attraction) => ({ id: a.id, name: a.name })));
        } else {
          const freshAttractions = await attractionCacheService.getAttractions({ user_id: currentUser?.id });
          setAttractions(freshAttractions.map((a: Attraction) => ({ id: a.id, name: a.name })));
        }
      }
    } catch {
      console.error('Failed to load entities');
    } finally {
      setLoadingEntities(false);
    }
  }, [currentUser?.id]);

  // Apply client-side filters
  const applyFilters = useCallback(() => {
    let result = [...specialPricings];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(sp =>
        sp.name.toLowerCase().includes(term) ||
        sp.description?.toLowerCase().includes(term)
      );
    }
    if (filters.entity_type !== 'all') {
      result = result.filter(sp => sp.entity_type === filters.entity_type || sp.entity_type === 'all');
    }
    if (filters.recurrence_type !== 'all') {
      result = result.filter(sp => sp.recurrence_type === filters.recurrence_type);
    }
    if (filters.discount_type !== 'all') {
      result = result.filter(sp => sp.discount_type === filters.discount_type);
    }
    if (filters.status !== 'all') {
      result = result.filter(sp => (filters.status === 'active' ? sp.is_active : !sp.is_active));
    }

    setFilteredSpecialPricings(result);
  }, [specialPricings, filters]);

  useEffect(() => { loadSpecialPricings(); loadLocations(); }, [loadSpecialPricings, loadLocations]);
  useEffect(() => { applyFilters(); }, [applyFilters]);
  useEffect(() => { setCurrentPage(1); }, [filters]);

  // Load entities when modal opens
  useEffect(() => {
    if (showModal) {
      loadEntities(form.entity_type);
    }
  }, [showModal, form.entity_type, loadEntities]);

  // Handlers
  const handleFilterChange = (key: keyof SpecialPricingListFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ entity_type: 'all', recurrence_type: 'all', discount_type: 'all', status: 'all', search: '' });
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await specialPricingService.toggleStatus(id);
      setSpecialPricings(prev => prev.map(sp => sp.id === id ? { ...sp, is_active: !sp.is_active } : sp));
      setToast({ message: 'Status updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this special pricing?')) return;
    try {
      await specialPricingService.deleteSpecialPricing(id);
      setSpecialPricings(prev => prev.filter(sp => sp.id !== id));
      setSelectedItems(prev => { const n = new Set(prev); n.delete(id); return n; });
      setToast({ message: 'Special pricing deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete special pricing', type: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Delete ${selectedItems.size} special pricing(s)?`)) return;
    try {
      await specialPricingService.bulkDelete(Array.from(selectedItems));
      setSpecialPricings(prev => prev.filter(sp => !selectedItems.has(sp.id)));
      setSelectedItems(new Set());
      setToast({ message: `${selectedItems.size} special pricing(s) deleted`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete special pricings', type: 'error' });
    }
  };

  const toggleSelectItem = (id: number) => {
    setSelectedItems(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === currentItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(currentItems.map(sp => sp.id)));
    }
  };

  const formatDiscountAmount = (sp: SpecialPricing) => {
    if (sp.discount_type === 'percentage') return `${parseFloat(sp.discount_amount)}%`;
    return `$${parseFloat(sp.discount_amount).toFixed(2)}`;
  };

  const formatRecurrence = (sp: SpecialPricing) => {
    if (sp.recurrence_display) return sp.recurrence_display;
    if (sp.recurrence_type === 'one_time' && sp.specific_date) {
      return new Date(sp.specific_date).toLocaleDateString();
    }
    if (sp.recurrence_type === 'weekly' && sp.recurrence_value !== null) {
      return `Every ${DAY_OF_WEEK[sp.recurrence_value]?.label || ''}`;
    }
    if (sp.recurrence_type === 'monthly' && sp.recurrence_value !== null) {
      return `${sp.recurrence_value}${getOrdinalSuffix(sp.recurrence_value)} of month`;
    }
    return sp.recurrence_type;
  };

  // Modal handlers
  const openCreateModal = () => {
    setEditingSpecialPricing(null);
    setForm({
      company_id: currentUser?.company_id || 1,
      location_id: isCompanyAdmin ? null : userLocationId, // Auto-set location for non-admins
      name: '',
      description: '',
      discount_amount: 10,
      discount_type: 'percentage',
      recurrence_type: 'weekly',
      recurrence_value: 2,
      specific_date: null,
      start_date: null,
      end_date: null,
      time_start: null,
      time_end: null,
      entity_type: initialEntityType !== 'all' ? initialEntityType : 'all',
      entity_ids: [],
      priority: 0,
      is_stackable: false,
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (sp: SpecialPricing) => {
    setEditingSpecialPricing(sp);
    setForm({
      company_id: sp.company_id,
      location_id: sp.location_id,
      name: sp.name,
      description: sp.description || '',
      discount_amount: parseFloat(sp.discount_amount),
      discount_type: sp.discount_type,
      recurrence_type: sp.recurrence_type,
      recurrence_value: sp.recurrence_value,
      specific_date: sp.specific_date,
      start_date: sp.start_date,
      end_date: sp.end_date,
      time_start: sp.time_start?.slice(0, 5) || null,
      time_end: sp.time_end?.slice(0, 5) || null,
      entity_type: sp.entity_type,
      entity_ids: sp.entity_ids || [],
      priority: sp.priority,
      is_stackable: sp.is_stackable,
      is_active: sp.is_active,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSpecialPricing(null);
  };

  const handleFormChange = (field: keyof SpecialPricingFormData, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (field === 'entity_type') {
      setForm(prev => ({ ...prev, entity_ids: [] }));
    }
    if (field === 'recurrence_type') {
      const recType = value as RecurrenceType;
      setForm(prev => ({
        ...prev,
        recurrence_value: recType === 'weekly' ? 2 : recType === 'monthly' ? 1 : null,
        specific_date: recType === 'one_time' ? '' : null,
      }));
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setToast({ message: 'Name is required', type: 'error' });
      return;
    }
    if (form.discount_amount <= 0) {
      setToast({ message: 'Discount amount must be greater than 0', type: 'error' });
      return;
    }
    if (form.discount_type === 'percentage' && form.discount_amount > 100) {
      setToast({ message: 'Percentage discount cannot exceed 100%', type: 'error' });
      return;
    }
    if (form.recurrence_type === 'one_time' && !form.specific_date) {
      setToast({ message: 'Specific date is required for one-time discounts', type: 'error' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        entity_ids: form.entity_ids.length > 0 ? form.entity_ids : null,
      };

      if (editingSpecialPricing) {
        await specialPricingService.updateSpecialPricing(editingSpecialPricing.id, payload);
        setToast({ message: 'Special pricing updated successfully', type: 'success' });
      } else {
        await specialPricingService.createSpecialPricing(payload);
        setToast({ message: 'Special pricing created successfully', type: 'success' });
      }
      closeModal();
      loadSpecialPricings();
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Failed to save special pricing';
      setToast({ message: errMsg, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Live preview calculation
  const samplePrice = 100;
  const previewDiscount = form.discount_type === 'percentage'
    ? samplePrice * (form.discount_amount / 100)
    : form.discount_amount;
  const previewTotal = samplePrice - previewDiscount;

  // Metrics
  const totalActive = specialPricings.filter(sp => sp.is_active).length;
  const weeklyCount = specialPricings.filter(sp => sp.recurrence_type === 'weekly').length;
  const oneTimeCount = specialPricings.filter(sp => sp.recurrence_type === 'one_time').length;

  // Pagination
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredSpecialPricings.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredSpecialPricings.length / itemsPerPage);

  // Back path
  const backPath = initialEntityType === 'package' ? '/packages' : initialEntityType === 'attraction' ? '/attractions' : null;

  // Entities for selection
  const getEntitiesForSelection = () => {
    if (form.entity_type === 'package') return packages;
    if (form.entity_type === 'attraction') return attractions;
    return [...packages.map(p => ({ ...p, type: 'package' })), ...attractions.map(a => ({ ...a, type: 'attraction' }))];
  };

  const entities = getEntitiesForSelection();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
        <div className="flex items-center gap-3">
          {backPath && (
            <button onClick={() => navigate(backPath)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Special Pricing</h1>
            <p className="text-gray-600 mt-1">Manage automatic discounts for packages and attractions</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreateModal}>
            Create Special Pricing
          </StandardButton>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Total Special Pricings', value: specialPricings.length.toString(), sub: `${totalActive} active`, icon: Tag },
          { title: 'Weekly Recurring', value: weeklyCount.toString(), sub: 'Every week discounts', icon: Repeat },
          { title: 'One-Time Events', value: oneTimeCount.toString(), sub: 'Specific date sales', icon: Calendar },
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

      {/* Filters & Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        {selectedItems.size > 0 && (
          <div className={`flex items-center justify-between p-3 mb-4 rounded-lg bg-${themeColor}-50 border border-${themeColor}-200`}>
            <span className={`text-sm font-medium text-${themeColor}-800`}>{selectedItems.size} selected</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedItems(new Set())} className={`text-sm text-${themeColor}-600 hover:text-${themeColor}-800 underline`}>Clear</button>
              <StandardButton variant="danger" size="sm" icon={Trash2} onClick={handleBulkDelete}>Delete Selected</StandardButton>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative flex-1 max-w-lg">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-600" />
            </div>
            <input
              type="text"
              placeholder="Search special pricings..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filters</StandardButton>
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={loadSpecialPricings}>{''}</StandardButton>
          </div>
        </div>

        {showFilters && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Entity Type</label>
                <select value={filters.entity_type} onChange={(e) => handleFilterChange('entity_type', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All Types</option>
                  <option value="package">Package</option>
                  <option value="attraction">Attraction</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Recurrence</label>
                <select value={filters.recurrence_type} onChange={(e) => handleFilterChange('recurrence_type', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All</option>
                  <option value="one_time">One-Time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Discount Type</label>
                <select value={filters.discount_type} onChange={(e) => handleFilterChange('discount_type', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All</option>
                  <option value="fixed">Fixed ($)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Status</label>
                <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StandardButton variant="ghost" size="sm" onClick={clearFilters}>Clear Filters</StandardButton>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-left">
                  <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-600">
                    {selectedItems.size === currentItems.length && currentItems.length > 0 ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Discount</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Recurrence</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entity Type</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Stackable</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center">
                    <Tag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No special pricings found</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((sp) => {
                  const isSelected = selectedItems.has(sp.id);
                  return (
                    <tr key={sp.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? `bg-${themeColor}-50` : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelectItem(sp.id)} className="text-gray-400 hover:text-gray-600">
                          {isSelected ? <CheckSquare className={`w-4 h-4 text-${fullColor}`} /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{sp.name}</span>
                          {sp.description && <p className="text-xs text-gray-500 truncate max-w-[200px]">{sp.description}</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${themeColor}-100 text-${fullColor}`}>
                          {sp.discount_type === 'fixed' ? <DollarSign className="w-3 h-3" /> : <Percent className="w-3 h-3" />}
                          {formatDiscountAmount(sp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          sp.recurrence_type === 'one_time' ? `bg-${themeColor}-100 text-${fullColor}` :
                          sp.recurrence_type === 'weekly' ? 'bg-gray-100 text-gray-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {sp.recurrence_type === 'one_time' ? <Calendar className="w-3 h-3" /> :
                           sp.recurrence_type === 'weekly' ? <Repeat className="w-3 h-3" /> :
                           <Repeat className="w-3 h-3" />}
                          {formatRecurrence(sp)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          sp.entity_type === 'package' ? `bg-${themeColor}-100 text-${fullColor}` :
                          sp.entity_type === 'attraction' ? `bg-${themeColor}-100 text-${fullColor}` :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {sp.entity_type === 'package' ? <PackageIcon className="w-3 h-3" /> :
                           sp.entity_type === 'attraction' ? <Ticket className="w-3 h-3" /> :
                           <Layers className="w-3 h-3" />}
                          {sp.entity_type === 'package' ? 'Package' : sp.entity_type === 'attraction' ? 'Attraction' : 'All'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{sp.priority}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sp.is_stackable ? `bg-${themeColor}-100 text-${fullColor}` : 'bg-gray-100 text-gray-500'}`}>
                          {sp.is_stackable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(sp.id)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${sp.is_active ? `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          <Power className="w-3 h-3" />
                          {sp.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(sp)} className={`p-2 text-gray-400 hover:text-${themeColor}-600 hover:bg-${themeColor}-50 rounded-lg transition-colors`} title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(sp.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredSpecialPricings.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredSpecialPricings.length)} of {filteredSpecialPricings.length}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) pageNum = i + 1;
                else if (currentPage <= 3) pageNum = i + 1;
                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                else pageNum = currentPage - 2 + i;
                return (
                  <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? `bg-${fullColor} text-white` : 'text-gray-700 hover:bg-gray-50'}`}>
                    {pageNum}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeModal}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Modal Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`w-10 h-10 rounded-xl bg-${themeColor}-100 flex items-center justify-center flex-shrink-0`}>
                  <Tag className={`w-5 h-5 text-${fullColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {editingSpecialPricing ? 'Edit Special Pricing' : 'Create Special Pricing'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {editingSpecialPricing ? 'Modify the discount rule for your packages or attractions.' : 'Set up automatic discounts that apply to bookings based on your schedule.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discount Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="e.g., Tuesday Special, Weekend Sale"
                    className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Optional description for this discount"
                    rows={2}
                    className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none resize-none`}
                  />
                </div>

                {/* Location - Only show for company_admin */}
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

                {/* Discount Settings */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <DollarSign className={`w-4 h-4 text-${fullColor}`} /> Discount Settings
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Configure how much your customers save on each booking.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                      <select
                        value={form.discount_type}
                        onChange={(e) => handleFormChange('discount_type', e.target.value)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount {form.discount_type === 'percentage' ? '(%)' : '($)'}
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 font-medium">{form.discount_type === 'percentage' ? '%' : '$'}</span>
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={form.discount_type === 'percentage' ? '100' : undefined}
                          value={form.discount_amount}
                          onChange={(e) => handleFormChange('discount_amount', parseFloat(e.target.value) || 0)}
                          className={`w-full pl-9 border border-gray-200 rounded-lg py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  <div className={`mt-3 bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3 text-sm`}>
                    <span className="text-gray-600">Preview: </span>
                    <span className="text-gray-400 line-through">${samplePrice.toFixed(2)}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className={`text-${fullColor} font-semibold`}>${previewTotal.toFixed(2)}</span>
                    <span className="text-gray-500 ml-2">(-${previewDiscount.toFixed(2)})</span>
                  </div>
                </div>

                {/* Schedule */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Calendar className={`w-4 h-4 text-${fullColor}`} /> Schedule
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Control when this discount is active — one-time, weekly, or monthly.</p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Recurrence</label>
                    <select
                      value={form.recurrence_type}
                      onChange={(e) => handleFormChange('recurrence_type', e.target.value)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="one_time">One-Time (Specific Date)</option>
                      <option value="weekly">Weekly (Every Week)</option>
                      <option value="monthly">Monthly (Every Month)</option>
                    </select>
                  </div>

                  {/* One-Time Date */}
                  {form.recurrence_type === 'one_time' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={form.specific_date || ''}
                        onChange={(e) => handleFormChange('specific_date', e.target.value)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                        required
                      />
                    </div>
                  )}

                  {/* Weekly Day Selection */}
                  {form.recurrence_type === 'weekly' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of Week <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {DAY_OF_WEEK.map(day => (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => handleFormChange('recurrence_value', day.value)}
                            className={`py-2 rounded-lg text-sm font-medium transition-all ${
                              form.recurrence_value === day.value 
                                ? `bg-${fullColor} text-white` 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day.label.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Monthly Day Selection - Improved with grid */}
                  {form.recurrence_type === 'monthly' && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Day of Month <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => handleFormChange('recurrence_value', day)}
                            className={`py-2 rounded-lg text-sm font-medium transition-all ${
                              form.recurrence_value === day 
                                ? `bg-${fullColor} text-white` 
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Discount applies on the {form.recurrence_value || 1}{getOrdinalSuffix(form.recurrence_value || 1)} of each month</p>
                    </div>
                  )}

                  {/* Date Range for recurring */}
                  {form.recurrence_type !== 'one_time' && (
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                        <input
                          type="date"
                          value={form.start_date || ''}
                          onChange={(e) => handleFormChange('start_date', e.target.value || null)}
                          className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                        <input
                          type="date"
                          value={form.end_date || ''}
                          onChange={(e) => handleFormChange('end_date', e.target.value || null)}
                          className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Time Window */}
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time From</label>
                      <input
                        type="time"
                        value={form.time_start || ''}
                        onChange={(e) => handleFormChange('time_start', e.target.value || null)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Time To</label>
                      <input
                        type="time"
                        value={form.time_end || ''}
                        onChange={(e) => handleFormChange('time_end', e.target.value || null)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      />
                    </div>
                  </div>
                </div>

                {/* Apply To */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Layers className={`w-4 h-4 text-${fullColor}`} /> Apply To
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Choose which items receive this discount.</p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
                    <select
                      value={form.entity_type}
                      onChange={(e) => handleFormChange('entity_type', e.target.value)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="all">All (Packages & Attractions)</option>
                      <option value="package">Packages Only</option>
                      <option value="attraction">Attractions Only</option>
                    </select>
                  </div>

                  {/* Entity Selection */}
                  {form.entity_type !== 'all' && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700">
                          Select {form.entity_type === 'package' ? 'Packages' : 'Attractions'}
                        </label>
                        <span className="text-xs text-gray-500">Empty = All</span>
                      </div>
                      {loadingEntities ? (
                        <div className="flex items-center justify-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                          <div className={`animate-spin rounded-full h-5 w-5 border-b-2 border-${fullColor}`}></div>
                        </div>
                      ) : entities.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                          No {form.entity_type === 'package' ? 'packages' : 'attractions'} found
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
                  )}
                </div>

                {/* Advanced Settings */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Settings className={`w-4 h-4 text-${fullColor}`} /> Advanced
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Fine-tune priority and stacking behavior.</p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                      <input
                        type="number"
                        min="0"
                        value={form.priority}
                        onChange={(e) => handleFormChange('priority', parseInt(e.target.value) || 0)}
                        className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                      />
                      <p className="text-xs text-gray-500 mt-1">Higher = applies first</p>
                    </div>
                    <div className="flex flex-col justify-center">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={form.is_stackable}
                          onChange={(e) => handleFormChange('is_stackable', e.target.checked)}
                          className={`h-4 w-4 text-${fullColor} focus:ring-${themeColor}-500 border-gray-300 rounded`}
                        />
                        <label className="ml-2 block text-sm text-gray-900">Stackable</label>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Can combine with others</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-4">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => handleFormChange('is_active', e.target.checked)}
                      className={`h-4 w-4 text-${fullColor} focus:ring-${themeColor}-500 border-gray-300 rounded`}
                    />
                    <label className="ml-2 block text-sm text-gray-900">Active</label>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4">
                  <StandardButton type="button" variant="secondary" onClick={closeModal}>Cancel</StandardButton>
                  <StandardButton type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Saving...' : (editingSpecialPricing ? 'Update' : 'Create')}
                  </StandardButton>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default SpecialPricings;
