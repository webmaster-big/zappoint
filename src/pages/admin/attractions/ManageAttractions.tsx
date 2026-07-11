import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  Pencil,
  Trash2,
  Users,
  DollarSign,
  Zap,
  Star,
  ShoppingCart,
  Download,
  Upload,
  X,
  CheckSquare,
  Square,
  Link2,
  Copy,
  Percent,
  CalendarDays,
  ChevronUp,
  ChevronDown,
  FileDown
} from 'lucide-react';
import { formatDurationDisplay } from '../../../utils/timeFormat';
import { useThemeColor } from '../../../hooks/useThemeColor';
import CounterAnimation from '../../../components/ui/CounterAnimation';
import StandardButton from '../../../components/ui/StandardButton';
import ActionMenu from '../../../components/ui/ActionMenu';
import type { ManageAttractionsAttraction } from '../../../types/manageAttractions.types';
import { attractionService } from '../../../services/AttractionService';
import { attractionCacheService } from '../../../services/AttractionCacheService';
import type { Attraction, AttractionFilters, CreateAttractionData } from '../../../services/AttractionService';
import { useLocationScope } from '../../../contexts/LocationContext';
import Toast from '../../../components/ui/Toast';
import { createSlugWithId } from '../../../utils/slug';
import { getStoredUser } from '../../../utils/storage';
import {
  AdminDataTable,
  AdminTableToolbar,
  BulkActionsBar,
  exportTableCsv,
  useAdminTable,
} from '../../../components/admin/table';
import type { AdminColumn, AdminFilterDef } from '../../../components/admin/table';

type AttractionRow = ManageAttractionsAttraction & { updatedAt?: string };

type RawAttraction = Attraction & { location?: { id: number; name: string } };

const convertAttraction = (attr: RawAttraction): AttractionRow => ({
  id: attr.id.toString(),
  name: attr.name,
  description: attr.description,
  category: attr.category,
  price: attr.price,
  pricingType: attr.pricing_type,
  maxCapacity: attr.max_capacity,
  duration: attr.duration?.toString() || '',
  durationUnit: attr.duration_unit || 'minutes',
  location: attr.location?.name || '',
  locationId: attr.location_id,
  locationName: attr.location?.name || '',
  images: attr.image ? (Array.isArray(attr.image) ? attr.image : [attr.image]) : [],
  status: attr.is_active ? 'active' : 'inactive',
  createdAt: attr.created_at,
  updatedAt: attr.updated_at,
  availability: typeof attr.availability === 'object' ? attr.availability as Record<string, boolean> : {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: true
  },
  displayCapacityToCustomers: attr.display_capacity_to_customers ?? true,
  displayOrder: attr.display_order ?? 0,
});

const formatCreatedAt = (dateStr: string): string => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const buildLocationSlug = (attraction: AttractionRow): string =>
  attraction.locationName
    ? attraction.locationName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    : `location-${attraction.locationId || '1'}`;

const buildPurchaseLink = (attraction: AttractionRow): string =>
  `${window.location.origin}/purchase/attraction/${buildLocationSlug(attraction)}/${createSlugWithId(attraction.name, attraction.id)}`;

const pricingSuffix = (pricingType: string): string =>
  pricingType === 'per_person' ? '/person' :
  pricingType === 'per_group' ? '/group' :
  pricingType === 'per_hour' ? '/hour' : '';

const pricingTypeLabel = (pricingType: string): string =>
  pricingType === 'per_person' ? 'Per Person' :
  pricingType === 'per_group' ? 'Per Group' :
  pricingType === 'per_hour' ? 'Per Hour' : pricingType;

const isUnlimitedDuration = (attraction: AttractionRow): boolean =>
  !attraction.duration || attraction.duration === '0';

const durationMinutes = (attraction: AttractionRow): number => {
  if (isUnlimitedDuration(attraction)) return 0;
  const value = parseFloat(attraction.duration);
  if (Number.isNaN(value)) return 0;
  return attraction.durationUnit === 'hours' ? value * 60 : value;
};

const ManageAttractions = () => {
  const navigate = useNavigate();
  const { themeColor, fullColor } = useThemeColor();
  const currentUser = getStoredUser();
  const isCompanyAdmin = currentUser?.role === 'company_admin';
  const { effectiveLocationId, locations: scopeLocations } = useLocationScope();
  const selectedLocation = effectiveLocationId;
  const [attractions, setAttractions] = useState<AttractionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedForExport, setSelectedForExport] = useState<string[]>([]);
  const [importData, setImportData] = useState<string>("");
  const [importLocationId, setImportLocationId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  const statusColors = {
    active: `bg-${themeColor}-100 text-${fullColor}`,
    inactive: 'bg-gray-100 text-gray-800',
    maintenance: 'bg-yellow-100 text-yellow-800',
  };

  useEffect(() => {
    loadAttractions();
  }, [selectedLocation]);

  useEffect(() => {
    const unsubscribe = attractionCacheService.onCacheUpdate(async (event) => {
      if (event.detail?.source === 'api') {
        const fresh = await attractionCacheService.getCachedAttractions();
        if (fresh && fresh.length > 0) {
          const converted = (fresh as RawAttraction[])
            .filter(attr => selectedLocation === null || attr.location_id === selectedLocation)
            .map(convertAttraction);
          setAttractions(converted);
        }
      }
    });
    return unsubscribe;
  }, [selectedLocation]);

  const loadAttractions = async () => {
    try {
      if (attractions.length === 0) setLoading(true);

      const cachedAttractions = await attractionCacheService.getCachedAttractions();

      if (cachedAttractions && cachedAttractions.length > 0) {
        const converted = (cachedAttractions as RawAttraction[])
          .filter(attr => selectedLocation === null || attr.location_id === selectedLocation)
          .map(convertAttraction);
        setAttractions(converted);
        setLoading(false);

        attractionCacheService.syncInBackground({ user_id: getStoredUser()?.id });
        return;
      }

      const params: AttractionFilters = {
        per_page: 100,
        user_id: getStoredUser()?.id,
      };

      if (selectedLocation !== null) {
        params.location_id = selectedLocation;
      }

      let allRaw: RawAttraction[] = [];
      let page = 1;
      let lastPage = 1;

      do {
        const response = await attractionService.getAttractions({ ...params, page });
        allRaw = allRaw.concat((response.data.attractions || []) as RawAttraction[]);
        lastPage = response.data.pagination?.last_page ?? 1;
        page++;
      } while (page <= lastPage);

      await attractionCacheService.cacheAttractions(allRaw);

      setAttractions(allRaw.map(convertAttraction));
    } catch (error) {
      console.error('Error loading attractions:', error);
      setToast({ message: 'Failed to load attractions', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveOrder = async (id: string, direction: 'up' | 'down') => {
    if (reordering) return;
    const ordered = [...attractions].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const index = ordered.findIndex(attr => attr.id === id);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || targetIndex < 0 || targetIndex >= ordered.length) return;

    [ordered[index], ordered[targetIndex]] = [ordered[targetIndex], ordered[index]];
    const reorderItems = ordered.map((attr, idx) => ({
      id: Number(attr.id),
      display_order: idx,
    }));

    const previous = attractions;
    setReordering(true);
    setAttractions(prev =>
      prev.map(attr => {
        const reordered = reorderItems.find(r => r.id === Number(attr.id));
        return reordered ? { ...attr, displayOrder: reordered.display_order } : attr;
      })
    );

    try {
      await attractionService.reorderAttractions(reorderItems);
      setToast({ message: 'Display order updated', type: 'success' });
    } catch {
      setAttractions(previous);
      setToast({ message: 'Failed to update display order', type: 'error' });
    } finally {
      setReordering(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: AttractionRow['status']) => {
    try {
      if (newStatus === 'active') {
        await attractionService.activateAttraction(Number(id));
      } else {
        await attractionService.deactivateAttraction(Number(id));
      }

      setAttractions(prev => prev.map(attraction =>
        attraction.id === id ? { ...attraction, status: newStatus } : attraction
      ));

      const cachedAttraction = await attractionCacheService.getAttractionFromCache(Number(id));
      if (cachedAttraction) {
        await attractionCacheService.updateAttractionInCache({
          ...cachedAttraction,
          is_active: newStatus === 'active'
        });
      }

      setToast({ message: 'Status updated successfully', type: 'success' });
    } catch (error) {
      console.error('Error updating status:', error);
      setToast({ message: 'Failed to update status', type: 'error' });
    }
  };

  const handleDeleteAttraction = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attraction? This action cannot be undone.')) {
      try {
        await attractionService.deleteAttraction(Number(id));

        setAttractions(prev => prev.filter(attraction => attraction.id !== id));

        await attractionCacheService.removeAttractionFromCache(Number(id));

        setToast({ message: 'Attraction deleted successfully', type: 'success' });
      } catch (error) {
        console.error('Error deleting attraction:', error);
        setToast({ message: 'Failed to delete attraction', type: 'error' });
      }
    }
  };

  const handleDuplicateAttraction = async (attraction: AttractionRow) => {
    try {
      setDuplicatingId(attraction.id);

      const response = await attractionService.getAttraction(Number(attraction.id));
      const original = response.data;

      const duplicateData: CreateAttractionData = {
        location_id: original.location_id,
        name: `${original.name} (Copy)`,
        description: original.description,
        price: original.price,
        pricing_type: original.pricing_type,
        max_capacity: original.max_capacity,
        category: original.category,
        duration: original.duration ?? undefined,
        duration_unit: original.duration_unit,
        availability: Array.isArray(original.availability) ? original.availability : undefined,
        image: original.image ?? undefined,
        is_active: false,
      };

      const createResponse = await attractionService.createAttraction(duplicateData);

      if (createResponse.success && createResponse.data) {
        await attractionCacheService.addAttractionToCache(createResponse.data);

        const newAttraction: AttractionRow = {
          ...convertAttraction(createResponse.data as RawAttraction),
          location: attraction.location,
          locationName: attraction.locationName,
        };
        setAttractions(prev => [newAttraction, ...prev]);

        setToast({ message: `"${original.name}" duplicated successfully!`, type: 'success' });
      }
    } catch (error) {
      console.error('Error duplicating attraction:', error);
      setToast({ message: 'Failed to duplicate attraction', type: 'error' });
    } finally {
      setDuplicatingId(null);
    }
  };

  const copyPurchaseLink = (attraction: AttractionRow) => {
    navigator.clipboard.writeText(buildPurchaseLink(attraction));
    setCopiedLink(attraction.id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const columns: AdminColumn<AttractionRow>[] = [
    {
      key: 'order',
      label: 'Order',
      group: 'Ordering',
      sortable: true,
      sortValue: attraction => attraction.displayOrder ?? 0,
      exportValue: attraction => attraction.displayOrder ?? 0,
      render: attraction => (
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col">
            <button
              onClick={() => handleMoveOrder(attraction.id, 'up')}
              disabled={reordering}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-40"
              title="Move up"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleMoveOrder(attraction.id, 'down')}
              disabled={reordering}
              className="text-gray-400 hover:text-gray-700 disabled:opacity-40"
              title="Move down"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs text-gray-500">{(attraction.displayOrder ?? 0) + 1}</span>
        </div>
      ),
    },
    {
      key: 'id',
      label: 'ID',
      group: 'Identifiers',
      sortable: true,
      sortValue: attraction => Number(attraction.id),
      exportValue: attraction => attraction.id,
      defaultVisible: false,
      render: attraction => <span className="text-sm text-gray-900">#{attraction.id}</span>,
    },
    {
      key: 'attraction',
      label: 'Attraction',
      group: 'Attraction',
      lockVisible: true,
      sortable: true,
      sortValue: attraction => attraction.name,
      exportValue: attraction => attraction.name,
      render: attraction => (
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{attraction.name}</span>
            {attraction.name?.includes('(Copy)') && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-300 shrink-0">
                <Copy className="w-2.5 h-2.5" />
                Copy
              </span>
            )}
          </div>
          <div className="text-xs text-gray-600 mt-1">{attraction.location}</div>
          <div className="text-xs text-gray-500 mt-1 line-clamp-2">{attraction.description}</div>
          {attraction.createdAt && (
            <div className="flex items-center gap-1 mt-1">
              <CalendarDays className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">{formatCreatedAt(attraction.createdAt)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      group: 'Attraction',
      sortable: true,
      sortValue: attraction => attraction.category,
      exportValue: attraction => attraction.category,
      render: attraction => <span className="whitespace-nowrap text-sm text-gray-900">{attraction.category}</span>,
    },
    {
      key: 'description',
      label: 'Description',
      group: 'Attraction',
      sortValue: attraction => attraction.description,
      exportValue: attraction => attraction.description,
      defaultVisible: false,
      render: attraction => (
        <span className="text-xs text-gray-600 line-clamp-2 max-w-xs block">{attraction.description}</span>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      group: 'Location',
      sortable: true,
      sortValue: attraction => attraction.location,
      exportValue: attraction => attraction.location,
      defaultVisible: false,
      render: attraction => <span className="whitespace-nowrap text-sm text-gray-900">{attraction.location || '—'}</span>,
    },
    {
      key: 'price',
      label: 'Price',
      group: 'Pricing',
      sortable: true,
      sortValue: attraction => Number(attraction.price),
      exportValue: attraction => Number(attraction.price).toFixed(2),
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          ${attraction.price}
          <span className="text-xs text-gray-600 ml-1">{pricingSuffix(attraction.pricingType)}</span>
        </span>
      ),
    },
    {
      key: 'pricingType',
      label: 'Pricing Type',
      group: 'Pricing',
      sortable: true,
      sortValue: attraction => attraction.pricingType,
      exportValue: attraction => pricingTypeLabel(attraction.pricingType),
      defaultVisible: false,
      render: attraction => <span className="whitespace-nowrap text-sm text-gray-900">{pricingTypeLabel(attraction.pricingType)}</span>,
    },
    {
      key: 'capacity',
      label: 'Capacity',
      group: 'Capacity',
      sortable: true,
      sortValue: attraction => Number(attraction.maxCapacity),
      exportValue: attraction => attraction.maxCapacity,
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {attraction.maxCapacity} people
          {!attraction.displayCapacityToCustomers && (
            <span className="ml-1 text-xs text-gray-400" title="Hidden from customers">(hidden)</span>
          )}
        </span>
      ),
    },
    {
      key: 'capacityVisibility',
      label: 'Capacity Visibility',
      group: 'Capacity',
      sortable: true,
      sortValue: attraction => (attraction.displayCapacityToCustomers === false ? 'Hidden' : 'Shown'),
      exportValue: attraction => (attraction.displayCapacityToCustomers === false ? 'Hidden' : 'Shown'),
      defaultVisible: false,
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {attraction.displayCapacityToCustomers === false ? 'Hidden' : 'Shown'}
        </span>
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      group: 'Details',
      sortable: true,
      sortValue: durationMinutes,
      exportValue: attraction =>
        isUnlimitedDuration(attraction)
          ? 'Unlimited'
          : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit),
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-900">
          {isUnlimitedDuration(attraction) ? 'Unlimited' : formatDurationDisplay(parseFloat(attraction.duration), attraction.durationUnit)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      group: 'Status',
      sortable: true,
      sortValue: attraction => attraction.status,
      exportValue: attraction => attraction.status,
      render: attraction => (
        <select
          value={attraction.status}
          onChange={(e) => handleStatusChange(attraction.id, e.target.value as AttractionRow['status'])}
          className={`text-xs font-medium px-3 py-1 rounded-full ${statusColors[attraction.status]} border-none focus:ring-2 focus:ring-${themeColor}-400`}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      ),
    },
    {
      key: 'purchaseLink',
      label: 'Purchase Link',
      group: 'Links',
      exportValue: buildPurchaseLink,
      render: attraction => (
        <StandardButton
          onClick={() => copyPurchaseLink(attraction)}
          variant="ghost"
          size="sm"
          icon={ShoppingCart}
          className={`bg-${themeColor}-100 text-${fullColor} hover:bg-${themeColor}-200 text-xs`}
          title="Copy purchase link"
        >
          {copiedLink === attraction.id ? 'Copied!' : 'Copy Link'}
        </StandardButton>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      group: 'Dates',
      sortable: true,
      sortValue: attraction => new Date(attraction.createdAt || 0).getTime(),
      exportValue: attraction => (attraction.createdAt ? new Date(attraction.createdAt).toLocaleString() : ''),
      defaultVisible: false,
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-500">{formatCreatedAt(attraction.createdAt)}</span>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Updated',
      group: 'Dates',
      sortable: true,
      sortValue: attraction => new Date(attraction.updatedAt || 0).getTime(),
      exportValue: attraction => (attraction.updatedAt ? new Date(attraction.updatedAt).toLocaleString() : ''),
      defaultVisible: false,
      render: attraction => (
        <span className="whitespace-nowrap text-sm text-gray-500">
          {attraction.updatedAt ? formatCreatedAt(attraction.updatedAt) : '—'}
        </span>
      ),
    },
  ];

  const categoryOptions = useMemo(() => {
    const unique = [...new Set(attractions.map(attraction => attraction.category).filter(Boolean))].sort();
    return unique.map(category => ({ value: category, label: category }));
  }, [attractions]);

  const filterDefs: AdminFilterDef<AttractionRow>[] = useMemo(() => [
    {
      type: 'select',
      key: 'status',
      label: 'Status',
      allLabel: 'All Statuses',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
      predicate: (attraction, value) => attraction.status === value,
    },
    {
      type: 'select',
      key: 'category',
      label: 'Category',
      allLabel: 'All Categories',
      options: categoryOptions,
      predicate: (attraction, value) => attraction.category === value,
    },
    {
      type: 'select',
      key: 'pricingType',
      label: 'Pricing Type',
      allLabel: 'All Pricing Types',
      options: [
        { value: 'per_person', label: 'Per Person' },
        { value: 'per_group', label: 'Per Group' },
        { value: 'per_hour', label: 'Per Hour' },
      ],
      predicate: (attraction, value) => attraction.pricingType === value,
    },
    {
      type: 'select',
      key: 'durationType',
      label: 'Duration',
      allLabel: 'All Durations',
      options: [
        { value: 'unlimited', label: 'Unlimited' },
        { value: 'timed', label: 'Timed' },
      ],
      predicate: (attraction, value) =>
        value === 'unlimited' ? isUnlimitedDuration(attraction) : !isUnlimitedDuration(attraction),
    },
    {
      type: 'select',
      key: 'capacityVisibility',
      label: 'Capacity Visibility',
      allLabel: 'All Visibility',
      options: [
        { value: 'shown', label: 'Shown to Customers' },
        { value: 'hidden', label: 'Hidden from Customers' },
      ],
      predicate: (attraction, value) =>
        value === 'hidden'
          ? attraction.displayCapacityToCustomers === false
          : attraction.displayCapacityToCustomers !== false,
    },
    {
      type: 'numberrange',
      key: 'price',
      label: 'Price ($)',
      getValue: attraction => Number(attraction.price),
    },
    {
      type: 'numberrange',
      key: 'capacity',
      label: 'Capacity',
      getValue: attraction => Number(attraction.maxCapacity),
    },
    {
      type: 'daterange',
      key: 'createdAt',
      label: 'Created Date',
      getDate: attraction => attraction.createdAt,
    },
  ], [categoryOptions]);

  const table = useAdminTable<AttractionRow>({
    data: attractions,
    columns,
    getRowId: attraction => attraction.id,
    storageKey: 'attractions',
    filterDefs,
    searchFields: attraction => [
      attraction.id,
      attraction.name,
      attraction.description,
      attraction.location,
      attraction.category,
      attraction.pricingType,
      attraction.status,
    ],
    defaultSort: (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
    itemsPerPage: 10,
  });

  const handleBulkDelete = async () => {
    if (table.selectedIds.length === 0) return;

    if (window.confirm(`Are you sure you want to delete ${table.selectedIds.length} attraction(s)? This action cannot be undone.`)) {
      try {
        await Promise.all(
          table.selectedIds.map(id => attractionService.deleteAttraction(Number(id)))
        );

        setAttractions(prev => prev.filter(attraction => !table.selectedIds.includes(attraction.id)));

        await Promise.all(
          table.selectedIds.map(id => attractionCacheService.removeAttractionFromCache(Number(id)))
        );

        setToast({ message: `${table.selectedIds.length} attraction(s) deleted successfully`, type: 'success' });
        table.clearSelection();
      } catch (error) {
        console.error('Error deleting attractions:', error);
        setToast({ message: 'Failed to delete some attractions', type: 'error' });
      }
    }
  };

  const handleBulkStatusChange = async (newStatus: AttractionRow['status']) => {
    if (!newStatus || table.selectedIds.length === 0) return;

    try {
      await Promise.all(
        table.selectedIds.map(id =>
          newStatus === 'active'
            ? attractionService.activateAttraction(Number(id))
            : attractionService.deactivateAttraction(Number(id))
        )
      );

      setAttractions(prev => prev.map(attraction =>
        table.selectedIds.includes(attraction.id)
          ? { ...attraction, status: newStatus }
          : attraction
      ));

      await Promise.all(
        table.selectedIds.map(async (id) => {
          const cachedAttraction = await attractionCacheService.getAttractionFromCache(Number(id));
          if (cachedAttraction) {
            await attractionCacheService.updateAttractionInCache({
              ...cachedAttraction,
              is_active: newStatus === 'active'
            });
          }
        })
      );

      setToast({ message: `${table.selectedIds.length} attraction(s) updated successfully`, type: 'success' });
      table.clearSelection();
    } catch (error) {
      console.error('Error updating attractions:', error);
      setToast({ message: 'Failed to update some attractions', type: 'error' });
    }
  };

  const exportToCSV = () => {
    exportTableCsv({
      filename: `zapzone-attractions-${new Date().toISOString().split('T')[0]}.csv`,
      columns,
      rows: table.filteredRows,
      extraColumns: [
        { label: 'Location ID', value: attraction => attraction.locationId ?? '' },
        { label: 'Duration Value', value: attraction => attraction.duration || '0' },
        { label: 'Duration Unit', value: attraction => attraction.durationUnit },
        { label: 'Images', value: attraction => (attraction.images || []).join(' | ') },
        { label: 'Availability', value: attraction => JSON.stringify(attraction.availability ?? {}) },
      ],
    });
  };

  const handleOpenExportModal = () => {
    setSelectedForExport(attractions.map(attraction => attraction.id));
    setShowExportModal(true);
  };

  const handleToggleExportSelection = (id: string) => {
    setSelectedForExport(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllForExport = () => {
    if (selectedForExport.length === attractions.length) {
      setSelectedForExport([]);
    } else {
      setSelectedForExport(attractions.map(attraction => attraction.id));
    }
  };

  const handleExport = () => {
    const attractionsToExport = attractions.filter(attraction => selectedForExport.includes(attraction.id || ''));
    const cleanedAttractions = attractionsToExport.map(attraction => {
      const clean = { ...(attraction as unknown as Record<string, unknown>) };
      delete clean.id;
      delete clean.location_id;
      delete clean.location;
      return clean;
    });
    const jsonData = JSON.stringify(cleanedAttractions, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zapzone-attractions-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  };

  const handleImport = async () => {
    try {
      const parsedData = JSON.parse(importData);
      if (!Array.isArray(parsedData)) {
        setToast({ message: 'Invalid data format. Please provide a valid JSON array of attractions.', type: 'error' });
        return;
      }

      const storedUser = getStoredUser();
      const targetLocationId = importLocationId || storedUser?.location_id || 1;

      const attractionsToImport = parsedData.map((attraction: AttractionRow) => ({
        location_id: targetLocationId,
        name: attraction.name,
        description: attraction.description,
        price: Number(attraction.price),
        pricing_type: attraction.pricingType || 'per_person',
        max_capacity: Number(attraction.maxCapacity),
        category: attraction.category,
        duration: attraction.duration ? Number(attraction.duration) : undefined,
        duration_unit: attraction.durationUnit as 'hours' | 'minutes' | 'hours and minutes',
        availability: Array.isArray(attraction.availability) ? attraction.availability : [{
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          start_time: '09:00',
          end_time: '17:00'
        }],
        image: attraction.images?.[0],
        is_active: attraction.status === 'active',
      }));

      try {
        const response = await attractionService.bulkImport({ attractions: attractionsToImport });

        setImportData("");
        setShowImportModal(false);

        const successCount = response.data.imported_count || 0;
        const failedCount = response.data.failed_count || 0;

        if (failedCount > 0) {
          console.error('Import errors:', response.errors);
          setToast({ message: `Imported ${successCount} attraction(s). ${failedCount} failed. Check console for details.`, type: 'info' });
        } else {
          setToast({ message: `Successfully imported ${successCount} attraction(s)!`, type: 'success' });
        }

        loadAttractions();
      } catch (err) {
        console.error('Bulk import failed, trying individual imports...', err);

        let successCount = 0;
        for (const attraction of attractionsToImport) {
          try {
            await attractionService.createAttraction(attraction);
            successCount++;
          } catch (err) {
            console.error('Failed to import attraction:', err);
          }
        }

        setImportData("");
        setShowImportModal(false);
        setToast({ message: `Successfully imported ${successCount} of ${attractionsToImport.length} attraction(s)!`, type: 'success' });
        loadAttractions();
      }
    } catch (error) {
      console.error('Import error:', error);
      setToast({ message: 'Invalid JSON format. Please check your data and try again.', type: 'error' });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  const metrics = [
    {
      title: 'Total Attractions',
      value: attractions.length.toString(),
      change: `${attractions.filter(a => a.status === 'active').length} active`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Star,
    },
    {
      title: 'Active Attractions',
      value: attractions.filter(a => a.status === 'active').length.toString(),
      change: `${attractions.filter(a => a.status === 'inactive').length} inactive`,
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Zap,
    },
    {
      title: 'Avg. Price',
      value: attractions.length > 0
        ? `$${(attractions.reduce((sum, a) => sum + Number(a.price), 0) / attractions.length).toFixed(2)}`
        : '$0.00',
      change: 'Per attraction',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: DollarSign,
    },
    {
      title: 'Total Capacity',
      value: attractions.reduce((sum, a) => sum + a.maxCapacity, 0).toString(),
      change: 'Across all attractions',
      accent: `bg-${themeColor}-100 text-${fullColor}`,
      icon: Users,
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className={`animate-spin rounded-full h-12 w-12 border-b-2 border-${fullColor}`}></div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Attractions</h1>
          <p className="text-gray-600 mt-1">View and manage all attractions</p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
          <ActionMenu
            items={[
              { label: 'Fee Supports', icon: DollarSign, onClick: () => navigate('/fee-supports?entity_type=attraction') },
              { label: 'Special Pricing', icon: Percent, onClick: () => navigate('/special-pricings?entity_type=attraction') },
              { label: 'Import Attractions', icon: Upload, onClick: () => setShowImportModal(true), dividerBefore: true },
              { label: 'Export Attractions', icon: Download, onClick: handleOpenExportModal, disabled: attractions.length === 0 },
              { label: 'Export CSV', icon: FileDown, onClick: exportToCSV, disabled: attractions.length === 0 },
            ]}
          />
          <StandardButton
            onClick={() => navigate('/attractions/create')}
            variant="primary"
            size="md"
          >
            New Attraction
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
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${metric.accent}`}>
                  <Icon size={20} />
                </div>
                <span className="text-base font-semibold text-gray-800">{metric.title}</span>
              </div>
              <div className="flex items-end gap-2 mt-2">
                <CounterAnimation value={metric.value} className="text-2xl font-bold text-gray-900" />
              </div>
              <p className="text-xs mt-1 text-gray-400">{metric.change}</p>
            </div>
          );
        })}
      </div>

      <AdminTableToolbar
        table={table}
        searchPlaceholder="Search attractions..."
        onRefresh={loadAttractions}
      />

      <BulkActionsBar table={table} itemLabel="attraction(s)">
        <select
          onChange={(e) => handleBulkStatusChange(e.target.value as AttractionRow['status'])}
          className={`border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-${themeColor}-400`}
        >
          <option value="">Change Status</option>
          <option value="active">Activate</option>
          <option value="inactive">Deactivate</option>
        </select>
        <StandardButton
          onClick={handleBulkDelete}
          variant="danger"
          size="md"
          icon={Trash2}
        >
          Delete
        </StandardButton>
      </BulkActionsBar>

      <AdminDataTable
        table={table}
        selectable
        itemLabel="attractions"
        emptyMessage="No attractions found"
        renderActions={(attraction) => (
          <div className="flex items-center gap-3">
            <Link
              to={buildPurchaseLink(attraction)}
              className={`text-${themeColor}-600 hover:text-${fullColor}`}
              title="View Purchase Page"
              target="_blank"
            >
              <Link2 className="h-4 w-4" />
            </Link>
            <Link
              to={`/attractions/details/${createSlugWithId(attraction.name, attraction.id)}`}
              className={`text-${fullColor} hover:text-${themeColor}-900`}
              title="View Details"
            >
              <Eye className="h-4 w-4" />
            </Link>
            <Link
              to={`/attractions/edit/${attraction.id}`}
              className="text-gray-600 hover:text-gray-800"
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              onClick={() => handleDuplicateAttraction(attraction)}
              className={`text-${themeColor}-600 hover:text-${fullColor} disabled:opacity-50`}
              title="Duplicate"
              disabled={duplicatingId === attraction.id}
            >
              {duplicatingId === attraction.id ? (
                <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
            <StandardButton
              onClick={() => handleDeleteAttraction(attraction.id)}
              variant="danger"
              size="sm"
              icon={Trash2}
              className="text-red-600 hover:text-red-800 p-1"
              title="Delete"
            />
          </div>
        )}
      />

      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowExportModal(false)}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Export Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Select attractions to export as JSON</p>
                </div>
                <StandardButton
                  onClick={() => setShowExportModal(false)}
                  variant="ghost"
                  size="md"
                  icon={X}
                  className="p-2"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <StandardButton
                  onClick={handleSelectAllForExport}
                  variant="ghost"
                  size="sm"
                  icon={selectedForExport.length === attractions.length ? CheckSquare : Square}
                >
                  {selectedForExport.length === attractions.length ? 'Deselect All' : 'Select All'}
                </StandardButton>
                <span className="text-sm text-gray-600">
                  {selectedForExport.length} of {attractions.length} selected
                </span>
              </div>

              <div className="space-y-2">
                {attractions.map((attraction) => (
                  <div
                    key={attraction.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedForExport.includes(attraction.id)
                        ? `border-${themeColor}-500 bg-${themeColor}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleToggleExportSelection(attraction.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {selectedForExport.includes(attraction.id) ? (
                          <CheckSquare size={18} className={`text-${themeColor}-700`} />
                        ) : (
                          <Square size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{attraction.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          {attraction.category} • ${attraction.price}
                          <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${statusColors[attraction.status]}`}>
                            {attraction.status}
                          </span>
                        </p>
                        {attraction.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{attraction.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => setShowExportModal(false)}
                variant="secondary"
                size="md"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleExport}
                disabled={selectedForExport.length === 0}
                variant="primary"
                size="md"
                icon={Download}
              >
                Export {selectedForExport.length} Attraction{selectedForExport.length !== 1 ? 's' : ''}
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => { setShowImportModal(false); setImportData(''); setImportLocationId(null); }}>
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Import Attractions</h3>
                  <p className="text-sm text-gray-500 mt-1">Upload or paste JSON data to import attractions</p>
                </div>
                <StandardButton
                  onClick={() => {
                    setShowImportModal(false);
                    setImportData('');
                    setImportLocationId(null);
                  }}
                  variant="ghost"
                  size="sm"
                  icon={X}
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {isCompanyAdmin && scopeLocations.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Import to Location
                  </label>
                  <select
                    value={importLocationId ?? ''}
                    onChange={(e) => setImportLocationId(e.target.value ? Number(e.target.value) : null)}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500`}
                  >
                    <option value="">Select a location...</option>
                    {scopeLocations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className={`block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-${themeColor}-50 file:text-${themeColor}-700 hover:file:bg-${themeColor}-100`}
                />
              </div>

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">OR</span>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Or Paste JSON Data
                  </label>
                  {importData && (
                    <StandardButton
                      onClick={() => setImportData('')}
                      variant="ghost"
                      size="sm"
                    >
                      Clear
                    </StandardButton>
                  )}
                </div>
                <textarea
                  value={importData}
                  onChange={(e) => setImportData(e.target.value)}
                  placeholder='[{"name": "Attraction Name", "category": "Category", "price": 50, ...}]'
                  rows={12}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-${themeColor}-500 focus:border-${themeColor}-500 font-mono text-sm`}
                />
              </div>

              <div className={`bg-${themeColor}-50 border border-${themeColor}-200 rounded-lg p-4`}>
                <h4 className={`text-sm font-semibold text-${themeColor}-900 mb-2`}>Import Notes:</h4>
                <ul className={`text-xs text-${fullColor} space-y-1`}>
                  <li>• JSON must be an array of attraction objects</li>
                  <li>• Each attraction must have at least a name and price</li>
                  <li>• Location data is ignored; attractions will be registered to the selected location</li>
                  <li>• New IDs will be generated to avoid conflicts</li>
                </ul>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <StandardButton
                onClick={() => {
                  setShowImportModal(false);
                  setImportData('');
                  setImportLocationId(null);
                }}
                variant="secondary"
              >
                Cancel
              </StandardButton>
              <StandardButton
                onClick={handleImport}
                disabled={!importData.trim() || (isCompanyAdmin && scopeLocations.length > 1 && !importLocationId)}
                variant="primary"
                icon={Upload}
              >
                Import Attractions
              </StandardButton>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ManageAttractions;
