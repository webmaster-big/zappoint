import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, CalendarOff, Check, CheckSquare, Clock, Copy, Edit2, Edit3, Filter, History, LayoutGrid, List, MapPin, Plus, RefreshCcw, RefreshCw, Search, Square, Trash2, User, Users, X } from 'lucide-react';
import StandardButton from '../../../components/ui/StandardButton';
import Pagination from '../../../components/ui/Pagination';
import Toast from '../../../components/ui/Toast';
import AvailabilityBlockForm from '../../../components/admin/availability/AvailabilityBlockForm';
import AvailabilityChangeLog from '../../../components/admin/availability/AvailabilityChangeLog';
import { dayOffService, type AvailabilityBlock, type DayOffFilters, type Pagination as PageInfo } from '../../../services/DayOffService';
import { useThemeColor } from '../../../hooks/useThemeColor';
import { useLocationScope } from '../../../contexts/LocationContext';
import { getStoredUser } from '../../../utils/storage';

type ListFilters = Pick<DayOffFilters, 'upcoming_only' | 'is_recurring' | 'sort_by' | 'sort_order'>;

interface FormState {
    mode: 'create' | 'edit' | 'bulk';
    source?: AvailabilityBlock | null;
    duplicate?: boolean;
    partners?: AvailabilityBlock[];
}

const DEFAULT_FILTERS: ListFilters = {
    upcoming_only: true,
    is_recurring: undefined,
    sort_by: 'date',
    sort_order: 'asc',
};

const VIEW_MODE_KEY = 'dayoffs_view_mode';

const readViewMode = (): 'card' | 'table' => {
    try {
        const saved = localStorage.getItem(VIEW_MODE_KEY);
        return saved === 'table' ? 'table' : 'card';
    } catch {
        return 'card';
    }
};

const parseLocalDate = (value: string): Date => {
    const [year, month, day] = value.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
};

const formatDay = (value: string): string =>
    parseLocalDate(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const isPastBlock = (block: AvailabilityBlock): boolean => {
    if (block.is_recurring) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return parseLocalDate(block.date) < today;
};

const windowBadgeClass = (block: AvailabilityBlock): string => {
    if (block.block_type === 'full_day') return 'bg-red-100 text-red-700';
    if (block.block_type === 'operating_window') return 'bg-amber-100 text-amber-800';
    return 'bg-gray-100 text-gray-700';
};

const errorText = (error: unknown, fallback: string): string =>
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message
    || (error instanceof Error ? error.message : fallback);

const targetKey = (block: AvailabilityBlock): string =>
    [block.package_ids, block.room_ids, block.attraction_ids, block.event_ids]
        .map(ids => [...(ids ?? [])].map(Number).sort((a, b) => a - b).join(','))
        .join('|');

const olderPartnersOf = (source: AvailabilityBlock | null | undefined, blocks: AvailabilityBlock[]): AvailabilityBlock[] => {
    if (!source || source.block_type !== 'legacy_closure') return [];
    const day = source.date.split('T')[0];
    const seen = new Set<number>();
    return blocks.filter(block => {
        if (block.id === source.id || seen.has(block.id)) return false;
        const partner = block.block_type === 'legacy_closure'
            && block.location_id === source.location_id
            && block.date.split('T')[0] === day
            && block.is_recurring === source.is_recurring
            && targetKey(block) === targetKey(source);
        if (partner) seen.add(block.id);
        return partner;
    });
};

const DayOffs: React.FC = () => {
    const { themeColor, fullColor } = useThemeColor();
    const currentUser = getStoredUser();
    const isCompanyAdmin = currentUser?.role === 'company_admin';
    const { effectiveLocationId, locations: scopeLocations } = useLocationScope();

    const [tab, setTab] = useState<'blocks' | 'history'>('blocks');
    const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filters, setFilters] = useState<ListFilters>(DEFAULT_FILTERS);
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);
    const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'table'>(readViewMode);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [formState, setFormState] = useState<FormState | null>(null);
    const [historyFor, setHistoryFor] = useState<AvailabilityBlock | null>(null);
    const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'info' } | null>(null);
    const [editingCell, setEditingCell] = useState<{ id: number; field: 'reason' | 'group_name' } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [savingCell, setSavingCell] = useState(false);
    const [formBusy, setFormBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const toastTimer = useRef<number | null>(null);
    const blocksRequest = useRef(0);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 4000);
    }, []);

    useEffect(() => () => {
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const fetchBlocks = useCallback(async () => {
        const request = ++blocksRequest.current;
        setLoading(true);
        setLoadError(null);
        try {
            const response = await dayOffService.getDayOffs({
                ...filters,
                page,
                per_page: 20,
                search: debouncedSearch || undefined,
                location_id: isCompanyAdmin && effectiveLocationId ? effectiveLocationId : undefined,
            });
            if (request !== blocksRequest.current) return;
            const pagination = response.data.pagination ?? null;
            if ((response.data.day_offs ?? []).length === 0 && pagination && pagination.current_page > 1 && pagination.total > 0) {
                setPage(pagination.last_page);
                return;
            }
            setBlocks(response.data.day_offs ?? []);
            setPageInfo(pagination);
            setSelectedIds(new Set());
        } catch (error) {
            if (request !== blocksRequest.current) return;
            setBlocks([]);
            setPageInfo(null);
            setLoadError(errorText(error, 'Could not load blocked dates.'));
        } finally {
            if (request === blocksRequest.current) setLoading(false);
        }
    }, [filters, page, debouncedSearch, isCompanyAdmin, effectiveLocationId]);

    useEffect(() => {
        if (tab === 'blocks') fetchBlocks();
    }, [fetchBlocks, tab]);

    useEffect(() => {
        setPage(1);
    }, [effectiveLocationId]);

    useEffect(() => {
        if (!formState && !historyFor) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || formBusy) return;
            setFormState(null);
            setHistoryFor(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [formState, historyFor, formBusy]);

    const changeViewMode = (mode: 'card' | 'table') => {
        setViewMode(mode);
        try {
            localStorage.setItem(VIEW_MODE_KEY, mode);
        } catch {
            return;
        }
    };

    const defaultLocationId = isCompanyAdmin
        ? (effectiveLocationId ?? null)
        : (currentUser?.location_id ?? null);

    const formLocations = scopeLocations.map(location => ({ id: location.id, name: location.name }));

    const closeForm = (message?: string, type?: 'success' | 'error' | 'info') => {
        setFormState(null);
        setFormBusy(false);
        if (message) {
            showToast(message, type);
            fetchBlocks();
        }
    };

    const handleDelete = async (block: AvailabilityBlock) => {
        const label = block.group_name ? ` for ${block.group_name}` : '';
        if (!window.confirm(`Remove the block on ${formatDay(block.date)}${label}? Online booking reopens for that time. The removal is recorded permanently.`)) {
            return;
        }
        try {
            await dayOffService.deleteDayOff(block.id);
            showToast('Block removed.', 'success');
            fetchBlocks();
        } catch (error) {
            showToast(errorText(error, 'Could not remove this block.'), 'error');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) {
            showToast('Choose the blocks to remove first.', 'info');
            return;
        }
        if (!window.confirm(`Remove ${selectedIds.size} block${selectedIds.size === 1 ? '' : 's'}? Each removal is recorded permanently.`)) {
            return;
        }
        try {
            const response = await dayOffService.bulkDeleteDayOffs(Array.from(selectedIds));
            const removed = response.data?.deleted_count ?? 0;
            showToast(`Removed ${removed} block${removed === 1 ? '' : 's'}.`, removed === selectedIds.size ? 'success' : 'info');
            setSelectionMode(false);
            fetchBlocks();
        } catch (error) {
            showToast(errorText(error, 'Could not remove the selected blocks.'), 'error');
        }
    };

    const toggleSelected = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const allSelected = blocks.length > 0 && selectedIds.size === blocks.length;

    const startEditing = (block: AvailabilityBlock, field: 'reason' | 'group_name') => {
        setEditingCell({ id: block.id, field });
        setEditValue(block[field] ?? '');
        window.setTimeout(() => inputRef.current?.focus(), 0);
    };

    const saveCell = async () => {
        if (!editingCell) return;
        const value = editValue.trim();
        if (!value) {
            showToast(editingCell.field === 'reason' ? 'The reason cannot be empty.' : 'The group or event name cannot be empty.', 'error');
            return;
        }
        setSavingCell(true);
        try {
            const response = await dayOffService.updateDayOff(editingCell.id, { [editingCell.field]: value });
            setBlocks(prev => prev.map(block => (block.id === editingCell.id ? response.data : block)));
            showToast(response.message === 'Nothing changed' ? 'Nothing changed.' : 'Saved.', response.message === 'Nothing changed' ? 'info' : 'success');
            setEditingCell(null);
        } catch (error) {
            showToast(errorText(error, 'Could not save that change.'), 'error');
        } finally {
            setSavingCell(false);
        }
    };

    const renderEditable = (block: AvailabilityBlock, field: 'reason' | 'group_name', display: React.ReactNode) => {
        if (editingCell?.id === block.id && editingCell.field === field) {
            return (
                <div className="flex items-center gap-1" onClick={event => event.stopPropagation()}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={editValue}
                        maxLength={field === 'reason' ? 255 : 150}
                        onChange={event => setEditValue(event.target.value)}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                saveCell();
                            } else if (event.key === 'Escape') {
                                setEditingCell(null);
                            }
                        }}
                        disabled={savingCell}
                        className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900"
                    />
                    <button type="button" onClick={saveCell} disabled={savingCell} className="p-0.5 text-green-600 hover:text-green-700" aria-label="Save">
                        <Check className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setEditingCell(null)} disabled={savingCell} className="p-0.5 text-red-600 hover:text-red-700" aria-label="Cancel">
                        <X className="h-3.5 w-3.5" />
                    </button>
                </div>
            );
        }

        return (
            <button
                type="button"
                className="group flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-gray-100"
                onClick={event => {
                    event.stopPropagation();
                    startEditing(block, field);
                }}
                title="Click to edit"
            >
                <span className="truncate">{display || <span className="italic text-gray-400">—</span>}</span>
                <Edit3 className="h-3 w-3 shrink-0 text-gray-400 opacity-0 group-hover:opacity-100" />
            </button>
        );
    };

    const renderActions = (block: AvailabilityBlock) => (
        <div className="flex shrink-0 gap-1">
            <button type="button" onClick={event => { event.stopPropagation(); void openEdit(block); }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Edit">
                <Edit2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={event => { event.stopPropagation(); setFormState({ mode: 'create', source: block, duplicate: true }); }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Copy to another date">
                <Copy className="h-4 w-4" />
            </button>
            <button type="button" onClick={event => { event.stopPropagation(); setHistoryFor(block); }} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="History">
                <History className="h-4 w-4" />
            </button>
            <button type="button" onClick={event => { event.stopPropagation(); handleDelete(block); }} className="rounded-lg p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600" title="Remove">
                <Trash2 className="h-4 w-4" />
            </button>
        </div>
    );

    const renderPeople = (block: AvailabilityBlock) => (
        <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
                Set by {block.set_by?.name ?? 'not recorded'}
                {block.last_changed_by && block.last_changed_by.id !== block.set_by?.id ? ` · changed by ${block.last_changed_by.name}` : ''}
            </span>
        </span>
    );

    const openCreate = () => setFormState({ mode: 'create' });

    const openEdit = async (block: AvailabilityBlock) => {
        if (block.block_type !== 'legacy_closure') {
            setFormState({ mode: 'edit', source: block });
            return;
        }
        const day = block.date.split('T')[0];
        let candidates = blocks;
        try {
            const response = await dayOffService.getDayOffs({ location_id: block.location_id, start_date: day, end_date: day, per_page: 100 });
            candidates = [...(response.data.day_offs ?? []), ...blocks];
        } catch {
            candidates = blocks;
        }
        setFormState({ mode: 'edit', source: block, partners: olderPartnersOf(block, candidates) });
    };

    return (
        <div className="px-4 py-6 sm:px-6 sm:py-8">
            <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Days Off &amp; Availability</h1>
                    <p className="mt-1 text-gray-600">Block the location, birthday packages, rooms or attractions for a day or outside set hours.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {tab === 'blocks' && blocks.length > 0 && (
                        <StandardButton onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()); }} variant="secondary" size="md" icon={selectionMode ? X : CheckSquare}>
                            {selectionMode ? 'Cancel' : 'Select'}
                        </StandardButton>
                    )}
                    <StandardButton onClick={() => setFormState({ mode: 'bulk' })} variant="secondary" size="md" icon={Calendar}>
                        Several dates
                    </StandardButton>
                    <StandardButton onClick={openCreate} variant="primary" size="md" icon={Plus}>
                        Add block
                    </StandardButton>
                </div>
            </div>

            <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'blocks'} onClick={() => setTab('blocks')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'blocks' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-800'}`}>
                    Blocks
                </button>
                <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'history' ? 'bg-white text-gray-900 shadow' : 'text-gray-600 hover:text-gray-800'}`}>
                    Change history
                </button>
            </div>

            {tab === 'history' ? (
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                    <AvailabilityChangeLog showLocation={isCompanyAdmin} locationId={isCompanyAdmin ? effectiveLocationId : null} />
                </div>
            ) : (
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
                    {selectionMode && blocks.length > 0 && (
                        <div className={`mb-4 flex flex-col items-start justify-between gap-3 rounded-lg border border-${themeColor}-200 bg-${themeColor}-50 p-3 sm:flex-row sm:items-center`}>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                                    <input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? new Set() : new Set(blocks.map(block => block.id)))} className="h-4 w-4 rounded border-gray-300" />
                                    Select all on this page
                                </label>
                                <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
                                {selectedIds.size > 0 && (
                                    <StandardButton onClick={handleBulkDelete} variant="danger" size="sm" icon={Trash2}>
                                        Remove {selectedIds.size}
                                    </StandardButton>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                        <div className="relative w-full max-w-lg flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                                type="search"
                                placeholder="Search group, event or reason…"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                className="w-full rounded-lg border border-gray-200 py-1.5 pl-9 pr-3 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <StandardButton variant="secondary" size="sm" icon={Filter} onClick={() => setShowFilters(!showFilters)}>Filters</StandardButton>
                            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={fetchBlocks} title="Refresh">{''}</StandardButton>
                            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                                <button type="button" onClick={() => changeViewMode('card')} className={`rounded p-1.5 ${viewMode === 'card' ? `bg-white shadow text-${fullColor}` : 'text-gray-500 hover:text-gray-700'}`} title="Cards">
                                    <LayoutGrid className="h-4 w-4" />
                                </button>
                                <button type="button" onClick={() => changeViewMode('table')} className={`rounded p-1.5 ${viewMode === 'table' ? `bg-white shadow text-${fullColor}` : 'text-gray-500 hover:text-gray-700'}`} title="Table">
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="mb-4 rounded-lg bg-gray-50 p-3">
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                                <label className="text-xs font-medium text-gray-800">
                                    Dates
                                    <select value={filters.upcoming_only ? 'upcoming' : 'all'} onChange={event => { setFilters(prev => ({ ...prev, upcoming_only: event.target.value === 'upcoming' ? true : undefined })); setPage(1); }} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-normal">
                                        <option value="upcoming">Upcoming only</option>
                                        <option value="all">All dates</option>
                                    </select>
                                </label>
                                <label className="text-xs font-medium text-gray-800">
                                    Repeats
                                    <select value={filters.is_recurring === true ? 'recurring' : filters.is_recurring === false ? 'one-time' : 'all'} onChange={event => { const value = event.target.value; setFilters(prev => ({ ...prev, is_recurring: value === 'recurring' ? true : value === 'one-time' ? false : undefined })); setPage(1); }} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-normal">
                                        <option value="all">All</option>
                                        <option value="recurring">Every year</option>
                                        <option value="one-time">One time</option>
                                    </select>
                                </label>
                                <label className="text-xs font-medium text-gray-800">
                                    Sort by
                                    <select value={filters.sort_by} onChange={event => setFilters(prev => ({ ...prev, sort_by: event.target.value as 'date' | 'created_at' }))} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-normal">
                                        <option value="date">Date</option>
                                        <option value="created_at">Created</option>
                                    </select>
                                </label>
                                <label className="text-xs font-medium text-gray-800">
                                    Order
                                    <select value={filters.sort_order} onChange={event => setFilters(prev => ({ ...prev, sort_order: event.target.value as 'asc' | 'desc' }))} className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm font-normal">
                                        <option value="asc">Ascending</option>
                                        <option value="desc">Descending</option>
                                    </select>
                                </label>
                            </div>
                            <div className="mt-3 flex justify-end">
                                <StandardButton variant="ghost" size="sm" onClick={() => { setFilters(DEFAULT_FILTERS); setSearch(''); setPage(1); }}>Clear filters</StandardButton>
                            </div>
                        </div>
                    )}

                    {!loading && pageInfo && (
                        <p className="mb-3 text-sm text-gray-500">{pageInfo.total} block{pageInfo.total === 1 ? '' : 's'}</p>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-300" />
                        </div>
                    ) : loadError ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {loadError} <button type="button" onClick={fetchBlocks} className="ml-2 underline">Try again</button>
                        </div>
                    ) : blocks.length === 0 ? (
                        <div className="flex flex-col items-center py-14">
                            <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-${themeColor}-100`}>
                                <CalendarOff className={`h-8 w-8 text-${fullColor}`} />
                            </div>
                            <h3 className="mb-2 text-lg font-semibold text-gray-900">No blocked dates</h3>
                            <p className="mb-6 max-w-sm text-center text-sm text-gray-600">
                                {debouncedSearch || filters.is_recurring !== undefined || !filters.upcoming_only
                                    ? 'Nothing matches these filters.'
                                    : 'Block a date for a private group, a holiday, maintenance or shorter hours.'}
                            </p>
                            <StandardButton onClick={openCreate} variant="primary" size="md" icon={Plus}>Add block</StandardButton>
                        </div>
                    ) : viewMode === 'card' ? (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {blocks.map(block => {
                                const past = isPastBlock(block);
                                const chosen = selectedIds.has(block.id);
                                return (
                                    <div
                                        key={block.id}
                                        onClick={() => selectionMode && toggleSelected(block.id)}
                                        className={`relative rounded-xl border p-4 transition-shadow ${selectionMode ? 'cursor-pointer hover:shadow-lg' : 'hover:shadow-md'} ${chosen ? `border-${fullColor} bg-${themeColor}-50` : past ? 'border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-white'}`}
                                    >
                                        <div className="mb-2 flex items-start justify-between gap-2">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {selectionMode && (chosen ? <CheckSquare className={`h-5 w-5 shrink-0 text-${fullColor}`} /> : <Square className="h-5 w-5 shrink-0 text-gray-400" />)}
                                                <div className="min-w-0">
                                                    <h3 className="truncate text-base font-semibold text-gray-900">{formatDay(block.date)}</h3>
                                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                                        {block.is_recurring && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-purple-700"><RefreshCw className="h-3 w-3" />Every year</span>
                                                        )}
                                                        {past && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Past</span>}
                                                        {block.block_type === 'legacy_closure' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Older format</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            {!selectionMode && renderActions(block)}
                                        </div>

                                        <p className="mb-2 flex items-start gap-1.5 text-sm font-semibold text-gray-900">
                                            <Users className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
                                            <span className="break-words">{block.group_name || <span className="font-normal italic text-gray-400">No group or event name</span>}</span>
                                        </p>

                                        <div className="mb-2 flex flex-wrap gap-1.5">
                                            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${windowBadgeClass(block)}`}>
                                                <Clock className="h-3 w-3" />
                                                {block.window_label}
                                            </span>
                                            <span className="inline-flex max-w-full items-center rounded-lg bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700" title={block.scope_label}>
                                                <span className="truncate">{block.scope_label}</span>
                                            </span>
                                        </div>

                                        {block.reason && <p className="mb-2 line-clamp-2 text-sm text-gray-600">{block.reason}</p>}

                                        <div className="space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
                                            {isCompanyAdmin && block.location_name && (
                                                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{block.location_name}</span>
                                            )}
                                            {renderPeople(block)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="overflow-x-auto rounded-xl border border-gray-100">
                            <table className="w-full min-w-[56rem]">
                                <thead className="border-b border-gray-100 bg-gray-50">
                                    <tr>
                                        {selectionMode && (
                                            <th className="w-10 px-3 py-3 text-left">
                                                <button type="button" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(blocks.map(block => block.id)))} className="text-gray-500 hover:text-gray-700" aria-label="Select all">
                                                    {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                                                </button>
                                            </th>
                                        )}
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Group or event</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Blocked</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">When</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Set by</th>
                                        {isCompanyAdmin && <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Location</th>}
                                        <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {blocks.map(block => {
                                        const past = isPastBlock(block);
                                        const chosen = selectedIds.has(block.id);
                                        return (
                                            <tr key={block.id} onClick={() => selectionMode && toggleSelected(block.id)} className={`${selectionMode ? 'cursor-pointer' : ''} ${chosen ? `bg-${themeColor}-50` : past ? 'bg-gray-50/60 text-gray-500' : 'hover:bg-gray-50'}`}>
                                                {selectionMode && (
                                                    <td className="px-3 py-3">{chosen ? <CheckSquare className={`h-4 w-4 text-${fullColor}`} /> : <Square className="h-4 w-4 text-gray-400" />}</td>
                                                )}
                                                <td className="whitespace-nowrap px-3 py-3 text-sm font-medium text-gray-900">
                                                    {formatDay(block.date)}
                                                    {block.is_recurring && <RefreshCw className="ml-1.5 inline h-3.5 w-3.5 text-purple-500" aria-label="Every year" />}
                                                    {past && <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">Past</span>}
                                                </td>
                                                <td className="max-w-[14rem] px-3 py-3 text-sm text-gray-900">{renderEditable(block, 'group_name', block.group_name)}</td>
                                                <td className="max-w-[14rem] px-3 py-3 text-xs text-gray-700"><span className="line-clamp-2" title={block.scope_label}>{block.scope_label}</span></td>
                                                <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${windowBadgeClass(block)}`}><Clock className="h-3 w-3" />{block.window_label}</span></td>
                                                <td className="max-w-[14rem] px-3 py-3 text-sm text-gray-600">{renderEditable(block, 'reason', block.reason)}</td>
                                                <td className="px-3 py-3 text-xs text-gray-600">{block.set_by?.name ?? 'Not recorded'}</td>
                                                {isCompanyAdmin && <td className="px-3 py-3 text-xs text-gray-600">{block.location_name}</td>}
                                                <td className="px-3 py-3"><div className="flex justify-end">{!selectionMode && renderActions(block)}</div></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!loading && pageInfo && pageInfo.last_page > 1 && (
                        <div className="mt-6 flex justify-center">
                            <Pagination currentPage={pageInfo.current_page} totalPages={pageInfo.last_page} onPageChange={setPage} />
                        </div>
                    )}
                </div>
            )}

            {formState && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => !formBusy && closeForm()}>
                    <div
                        className={`my-6 w-full rounded-xl bg-white shadow-xl ${formState.mode === 'bulk' ? 'max-w-5xl' : 'max-w-2xl'}`}
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="availability-block-form-title"
                    >
                        <AvailabilityBlockForm
                            key={`${formState.mode}-${formState.source?.id ?? 'new'}-${formState.duplicate ? 'copy' : ''}`}
                            mode={formState.mode}
                            source={formState.source}
                            duplicate={formState.duplicate}
                            isCompanyAdmin={isCompanyAdmin}
                            locations={formLocations}
                            defaultLocationId={defaultLocationId}
                            themeColor={themeColor}
                            fullColor={fullColor}
                            onCancel={() => closeForm()}
                            onSaved={(message, type) => closeForm(message, type)}
                            onPartialSave={fetchBlocks}
                            onBusyChange={setFormBusy}
                            olderPartners={formState.mode === 'edit' ? formState.partners ?? [] : []}
                        />
                    </div>
                </div>
            )}

            {historyFor && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setHistoryFor(null)}>
                    <div className="my-6 w-full max-w-2xl rounded-xl bg-white shadow-xl" onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="block-history-title">
                        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
                            <div className="min-w-0">
                                <h2 id="block-history-title" className="text-lg font-semibold text-gray-900">History</h2>
                                <p className="mt-0.5 truncate text-sm text-gray-600">{formatDay(historyFor.date)} · {historyFor.group_name || historyFor.scope_label}</p>
                            </div>
                            <button type="button" onClick={() => setHistoryFor(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                            <AvailabilityChangeLog dayOffId={historyFor.id} showLocation={isCompanyAdmin} perPage={50} />
                        </div>
                    </div>
                </div>
            )}

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default DayOffs;
