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
  Layers
} from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { feeSupportService } from '../../../services/FeeSupportService';
import { packageCacheService } from '../../../services/PackageCacheService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import { locationService } from '../../../services/LocationService';
import { getStoredUser } from '../../../utils/storage';
import Toast from '../../../components/ui/Toast';
import StandardButton from '../../../components/ui/StandardButton';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import type { FeeSupport, FeeSupportListFilters, FeeSupportFormData } from '../../../types/FeeSupport.types';
import type { Package as PackageType } from '../../../services/PackageService';
import type { Attraction } from '../../../services/AttractionService';

const FeeSupports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  
  // Check if user is company admin (can select locations)
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  // For non-company admins, auto-use their location_id
  const userLocationId = currentUser?.location_id || null;

  // Pre-filter entity_type from URL query param (from Packages or Attractions pages)
  const entityTypeParam = searchParams.get('entity_type');
  const initialEntityType: 'package' | 'attraction' | 'all' = 
    entityTypeParam === 'package' || entityTypeParam === 'attraction' ? entityTypeParam : 'all';

  const [feeSupports, setFeeSupports] = useState<FeeSupport[]>([]);
  const [filteredFeeSupports, setFilteredFeeSupports] = useState<FeeSupport[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingFeeSupport, setEditingFeeSupport] = useState<FeeSupport | null>(null);
  const [saving, setSaving] = useState(false);

  // Entity data for the modal
  const [packages, setPackages] = useState<Array<{ id: number; name: string }>>([]);
  const [attractions, setAttractions] = useState<Array<{ id: number; name: string }>>([]);
  const [locations, setLocations] = useState<Array<{ id: number; name: string }>>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  // Form state
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

  const [filters, setFilters] = useState<FeeSupportListFilters>({
    entity_type: initialEntityType as FeeSupportListFilters['entity_type'],
    calculation_type: 'all',
    application_type: 'all',
    status: 'all',
    search: ''
  });

  // Load fee supports
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

  // Load entities using cache services for faster loading
  const loadEntities = useCallback(async (entityType: 'package' | 'attraction') => {
    setLoadingEntities(true);
    try {
      if (entityType === 'package') {
        // Try cache first for instant loading
        const cachedPackages = await packageCacheService.getCachedPackages();
        if (cachedPackages && cachedPackages.length > 0) {
          setPackages(cachedPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        } else {
          // Fetch from API and cache
          const freshPackages = await packageCacheService.getPackages({ user_id: currentUser?.id });
          setPackages(freshPackages.map((p: PackageType) => ({ id: p.id, name: p.name })));
        }
      } else {
        // Try cache first for instant loading
        const cachedAttractions = await attractionCacheService.getCachedAttractions();
        if (cachedAttractions && cachedAttractions.length > 0) {
          setAttractions(cachedAttractions.map((a: Attraction) => ({ id: a.id, name: a.name })));
        } else {
          // Fetch from API and cache
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
    let result = [...feeSupports];

    if (filters.search) {
      const term = filters.search.toLowerCase();
      result = result.filter(fs =>
        fs.fee_name.toLowerCase().includes(term) ||
        fs.location?.name?.toLowerCase().includes(term)
      );
    }
    if (filters.entity_type !== 'all') {
      result = result.filter(fs => fs.entity_type === filters.entity_type);
    }
    if (filters.calculation_type !== 'all') {
      result = result.filter(fs => fs.fee_calculation_type === filters.calculation_type);
    }
    if (filters.application_type !== 'all') {
      result = result.filter(fs => fs.fee_application_type === filters.application_type);
    }
    if (filters.status !== 'all') {
      result = result.filter(fs => (filters.status === 'active' ? fs.is_active : !fs.is_active));
    }

    setFilteredFeeSupports(result);
  }, [feeSupports, filters]);

  useEffect(() => { loadFeeSupports(); loadLocations(); }, [loadFeeSupports, loadLocations]);
  useEffect(() => { applyFilters(); }, [applyFilters]);
  useEffect(() => { setCurrentPage(1); }, [filters]);

  // Load entities when modal opens or entity type changes
  useEffect(() => {
    if (showModal) {
      loadEntities(form.entity_type);
    }
  }, [showModal, form.entity_type, loadEntities]);

  // Handlers
  const handleFilterChange = (key: keyof FeeSupportListFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({ entity_type: 'all', calculation_type: 'all', application_type: 'all', status: 'all', search: '' });
  };

  const handleToggleStatus = async (id: number) => {
    try {
      await feeSupportService.toggleStatus(id);
      setFeeSupports(prev => prev.map(fs => fs.id === id ? { ...fs, is_active: !fs.is_active } : fs));
      setToast({ message: 'Status updated', type: 'success' });
    } catch {
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this fee support?')) return;
    try {
      await feeSupportService.deleteFeeSupport(id);
      setFeeSupports(prev => prev.filter(fs => fs.id !== id));
      setSelectedItems(prev => { const n = new Set(prev); n.delete(id); return n; });
      setToast({ message: 'Fee support deleted', type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete fee support', type: 'error' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;
    if (!window.confirm(`Delete ${selectedItems.size} fee support(s)?`)) return;
    try {
      await feeSupportService.bulkDelete(Array.from(selectedItems));
      setFeeSupports(prev => prev.filter(fs => !selectedItems.has(fs.id)));
      setSelectedItems(new Set());
      setToast({ message: `${selectedItems.size} fee support(s) deleted`, type: 'success' });
    } catch {
      setToast({ message: 'Failed to delete fee supports', type: 'error' });
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
      setSelectedItems(new Set(currentItems.map(fs => fs.id)));
    }
  };

  const formatFeeAmount = (fs: FeeSupport) => {
    if (fs.fee_calculation_type === 'percentage') return `${parseFloat(fs.fee_amount)}%`;
    return `$${parseFloat(fs.fee_amount).toFixed(2)}`;
  };

  // Modal handlers
  const openCreateModal = () => {
    setEditingFeeSupport(null);
    setForm({
      company_id: currentUser?.company_id || 1,
      location_id: isCompanyAdmin ? null : userLocationId, // Auto-set location for non-admins
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
    // Clear entity_ids when switching entity type
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
    const entities = form.entity_type === 'package' ? packages : attractions;
    if (form.entity_ids.length === entities.length) {
      setForm(prev => ({ ...prev, entity_ids: [] }));
    } else {
      setForm(prev => ({ ...prev, entity_ids: entities.map(e => e.id) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
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

  // Live preview calculation
  const samplePrice = 100;
  const previewFeeAmount = form.fee_calculation_type === 'percentage'
    ? samplePrice * (form.fee_amount / 100)
    : form.fee_amount;
  const previewTotal = form.fee_application_type === 'additive'
    ? samplePrice + previewFeeAmount
    : samplePrice;

  // Metrics
  const totalActive = feeSupports.filter(fs => fs.is_active).length;
  const totalPackageFees = feeSupports.filter(fs => fs.entity_type === 'package').length;
  const totalAttractionFees = feeSupports.filter(fs => fs.entity_type === 'attraction').length;

  // Pagination
  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredFeeSupports.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredFeeSupports.length / itemsPerPage);

  // Determine back path based on entity_type query
  const backPath = initialEntityType === 'package' ? '/packages' : initialEntityType === 'attraction' ? '/attractions' : null;

  const entities = form.entity_type === 'package' ? packages : attractions;

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
            <h1 className="text-3xl font-bold text-gray-900">Fee Supports</h1>
            <p className="text-gray-600 mt-1">Manage additional fees for packages and attractions</p>
          </div>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <StandardButton variant="primary" size="md" icon={Plus} onClick={openCreateModal}>
            Create Fee
          </StandardButton>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          { title: 'Total Fee Supports', value: feeSupports.length.toString(), sub: `${totalActive} active`, icon: DollarSign },
          { title: 'Package Fees', value: totalPackageFees.toString(), sub: 'Applied to packages', icon: PackageIcon },
          { title: 'Attraction Fees', value: totalAttractionFees.toString(), sub: 'Applied to attractions', icon: Ticket },
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
        {/* Bulk actions */}
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
              placeholder="Search fee supports..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
            />
          </div>
          <div className="flex gap-1">
            <StandardButton variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filters</StandardButton>
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={loadFeeSupports}>{''}</StandardButton>
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
                <label className="block text-xs font-medium text-gray-800 mb-1">Calculation Type</label>
                <select value={filters.calculation_type} onChange={(e) => handleFilterChange('calculation_type', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All</option>
                  <option value="fixed">Fixed</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-800 mb-1">Application Type</label>
                <select value={filters.application_type} onChange={(e) => handleFilterChange('application_type', e.target.value)} className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600`}>
                  <option value="all">All</option>
                  <option value="additive">Additive</option>
                  <option value="inclusive">Inclusive</option>
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
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Fee Name</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Calculation</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Application</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entity Type</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Entities</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Location</th>
                <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No fee supports found</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((fs) => {
                  const isSelected = selectedItems.has(fs.id);
                  return (
                    <tr key={fs.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? `bg-${themeColor}-50` : ''}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleSelectItem(fs.id)} className="text-gray-400 hover:text-gray-600">
                          {isSelected ? <CheckSquare className={`w-4 h-4 text-${fullColor}`} /> : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{fs.fee_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-gray-900">{formatFeeAmount(fs)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-${themeColor}-100 text-${fullColor}`}>
                          {fs.fee_calculation_type === 'fixed' ? <DollarSign className="w-3 h-3" /> : <Percent className="w-3 h-3" />}
                          {fs.fee_calculation_type === 'fixed' ? 'Fixed' : 'Percentage'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${fs.fee_application_type === 'additive' ? `bg-${themeColor}-100 text-${fullColor}` : 'bg-gray-100 text-gray-600'}`}>
                          {fs.fee_application_type === 'additive' ? 'Additive' : 'Inclusive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${fs.entity_type === 'package' ? `bg-${themeColor}-100 text-${fullColor}` : `bg-${themeColor}-100 text-${fullColor}`}`}>
                          {fs.entity_type === 'package' ? <PackageIcon className="w-3 h-3" /> : <Ticket className="w-3 h-3" />}
                          {fs.entity_type === 'package' ? 'Package' : 'Attraction'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-500">{fs.entity_ids?.length || 0} item(s)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{fs.location?.name || 'All Locations'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleStatus(fs.id)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${fs.is_active ? `bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200` : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          <Power className="w-3 h-3" />
                          {fs.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredFeeSupports.length > itemsPerPage && (
          <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500">
              Showing {indexOfFirst + 1} to {Math.min(indexOfLast, filteredFeeSupports.length)} of {filteredFeeSupports.length}
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
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum ? `bg-${fullColor} text-white` : 'text-gray-700 hover:bg-gray-50'}`}
                  >
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Modal Header */}
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
                {/* Basic Info */}
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

                {/* Fee Settings */}
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

                  {/* Application Type */}
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
                  
                  {/* Preview */}
                  <div className={`mt-3 bg-${themeColor}-50 border border-${themeColor}-100 rounded-lg p-3 text-sm`}>
                    <span className="text-gray-600">Preview ($100): </span>
                    <span className={`text-${fullColor} font-semibold`}>+${previewFeeAmount.toFixed(2)}</span>
                    <span className="text-gray-500 ml-2">= ${previewTotal.toFixed(2)} total</span>
                  </div>
                </div>

                {/* Apply To */}
                <div className="border-t border-gray-200 pt-5">
                  <h4 className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <Layers className={`w-4 h-4 text-${fullColor}`} /> Apply To
                  </h4>
                  <p className="text-xs text-gray-400 mb-4">Select which packages or attractions include this fee.</p>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Entity Type</label>
                    <select
                      value={form.entity_type}
                      onChange={(e) => handleFormChange('entity_type', e.target.value)}
                      className={`w-full border border-gray-200 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 outline-none`}
                    >
                      <option value="package">Packages</option>
                      <option value="attraction">Attractions</option>
                    </select>
                  </div>

                  {/* Entity Selection */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">
                        Select {form.entity_type === 'package' ? 'Packages' : 'Attractions'} <span className="text-red-500">*</span>
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
                </div>

                {/* Status */}
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

                {/* Footer */}
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

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-fade-in-up">
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        </div>
      )}
    </div>
  );
};

export default FeeSupports;
