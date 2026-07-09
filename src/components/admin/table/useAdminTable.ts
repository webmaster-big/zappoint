import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AdminFilterDef,
  AdminTableConfig,
  AdminTableInstance,
  DateRangeValue,
  FilterChip,
  FilterValue,
  NumberRangeValue,
  SortDirection,
} from './types';

const defaultFilterValue = <T,>(def: AdminFilterDef<T>): FilterValue => {
  switch (def.type) {
    case 'select':
      return 'all';
    case 'multiselect':
      return [];
    case 'daterange':
      return { start: '', end: '' };
    case 'numberrange':
      return { min: '', max: '' };
  }
};

const isFilterActive = <T,>(def: AdminFilterDef<T>, value: FilterValue): boolean => {
  switch (def.type) {
    case 'select':
      return value !== 'all' && value !== '';
    case 'multiselect':
      return Array.isArray(value) && value.length > 0;
    case 'daterange': {
      const v = value as DateRangeValue;
      return !!(v.start || v.end);
    }
    case 'numberrange': {
      const v = value as NumberRangeValue;
      return !!(v.min || v.max);
    }
  }
};

const mergeOrder = (saved: string[], keys: string[]): string[] => [
  ...saved.filter(k => keys.includes(k)),
  ...keys.filter(k => !saved.includes(k)),
];

const readJson = <V,>(key: string): V | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as V) : null;
  } catch {
    return null;
  }
};

const compareValues = (a: string | number, b: string | number): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
};

export function useAdminTable<T>(config: AdminTableConfig<T>): AdminTableInstance<T> {
  const {
    data,
    columns,
    getRowId,
    storageKey,
    filterDefs = [],
    searchFields,
    serverSearch,
    serverSearchMinLength = 2,
    defaultSort,
    itemsPerPage = 10,
  } = config;

  const columnKeys = useMemo(() => columns.map(c => c.key), [columns]);
  const visibilityStorageKey = `${storageKey}_column_visibility`;
  const orderStorageKey = `${storageKey}_column_order`;

  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const defaults: Record<string, boolean> = {};
    columns.forEach(c => {
      defaults[c.key] = c.defaultVisible !== false;
    });
    const saved = readJson<Record<string, boolean>>(visibilityStorageKey);
    if (saved) {
      columnKeys.forEach(k => {
        if (typeof saved[k] === 'boolean') defaults[k] = saved[k];
      });
    }
    columns.forEach(c => {
      if (c.lockVisible) defaults[c.key] = true;
    });
    return defaults;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = readJson<string[]>(orderStorageKey);
    return saved ? mergeOrder(saved, columnKeys) : [...columnKeys];
  });

  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serverResults, setServerResults] = useState<T[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchVersionRef = useRef(0);

  const [filterValues, setFilterValues] = useState<Record<string, FilterValue>>(() => {
    const initial: Record<string, FilterValue> = {};
    filterDefs.forEach(def => {
      initial[def.key] = defaultFilterValue(def);
    });
    return initial;
  });

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!serverSearch) return;
    if (debouncedSearch.length < serverSearchMinLength) {
      setServerResults(null);
      setSearching(false);
      return;
    }
    const version = ++searchVersionRef.current;
    setSearching(true);
    serverSearch(debouncedSearch)
      .then(results => {
        if (version !== searchVersionRef.current) return;
        setServerResults(results);
      })
      .catch(() => {
        if (version !== searchVersionRef.current) return;
        setServerResults(null);
      })
      .finally(() => {
        if (version === searchVersionRef.current) setSearching(false);
      });
  }, [debouncedSearch, serverSearch, serverSearchMinLength]);

  const filterDefsRef = useRef(filterDefs);
  filterDefsRef.current = filterDefs;

  useEffect(() => {
    setFilterValues(prev => {
      const next: Record<string, FilterValue> = {};
      filterDefsRef.current.forEach(def => {
        next[def.key] = prev[def.key] ?? defaultFilterValue(def);
      });
      return next;
    });
  }, [filterDefs.map(d => d.key).join('|')]);

  const filteredRows = useMemo(() => {
    let result = serverResults !== null ? [...serverResults] : [...data];

    const term = debouncedSearch.toLowerCase();
    if (term && searchFields && serverResults === null) {
      const tokens = term.split(/\s+/).filter(Boolean);
      result = result.filter(row => {
        const fields = searchFields(row)
          .filter((f): f is string | number => f !== null && f !== undefined && f !== '')
          .map(f => String(f).toLowerCase());
        return tokens.every(token => fields.some(f => f.includes(token)));
      });
    }

    for (const def of filterDefs) {
      const value = filterValues[def.key];
      if (value === undefined || !isFilterActive(def, value)) continue;
      switch (def.type) {
        case 'select':
          result = result.filter(row => def.predicate(row, value as string));
          break;
        case 'multiselect':
          result = result.filter(row => def.predicate(row, value as string[]));
          break;
        case 'daterange': {
          const range = value as DateRangeValue;
          result = result.filter(row => {
            const raw = def.getDate(row);
            if (!raw) return false;
            const date = raw.split('T')[0];
            if (range.start && date < range.start) return false;
            if (range.end && date > range.end) return false;
            return true;
          });
          break;
        }
        case 'numberrange': {
          const range = value as NumberRangeValue;
          result = result.filter(row => {
            const num = def.getValue(row);
            if (range.min !== '' && num < parseFloat(range.min)) return false;
            if (range.max !== '' && num > parseFloat(range.max)) return false;
            return true;
          });
          break;
        }
      }
    }

    const activeColumn = sortColumn ? columns.find(c => c.key === sortColumn) : null;
    if (activeColumn?.sortValue) {
      const dir = sortDirection === 'asc' ? 1 : -1;
      result.sort((a, b) => compareValues(activeColumn.sortValue!(a), activeColumn.sortValue!(b)) * dir);
    } else if (defaultSort) {
      result.sort(defaultSort);
    }

    return result;
  }, [data, serverResults, debouncedSearch, searchFields, filterDefs, filterValues, sortColumn, sortDirection, columns, defaultSort]);

  const totalItems = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(page, totalPages);
  const rows = useMemo(
    () => filteredRows.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage),
    [filteredRows, safePage, itemsPerPage]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterValues]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const setFilterValue = (key: string, value: FilterValue) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    const cleared: Record<string, FilterValue> = {};
    filterDefs.forEach(def => {
      cleared[def.key] = defaultFilterValue(def);
    });
    setFilterValues(cleared);
    setSearchInput('');
  };

  const activeFilterCount = filterDefs.filter(def => {
    const value = filterValues[def.key];
    return value !== undefined && isFilterActive(def, value);
  }).length;

  const chips: FilterChip[] = [];
  filterDefs.forEach(def => {
    const value = filterValues[def.key];
    if (value === undefined || !isFilterActive(def, value)) return;
    const clear = () => setFilterValue(def.key, defaultFilterValue(def));
    switch (def.type) {
      case 'select': {
        const option = def.options.find(o => o.value === value);
        chips.push({ key: def.key, label: `${def.label}: ${option?.label || value}`, onClear: clear });
        break;
      }
      case 'multiselect': {
        const values = value as string[];
        const labels = values
          .map(v => def.options.find(o => o.value === v)?.label || v)
          .join(', ');
        chips.push({ key: def.key, label: `${def.label}: ${labels}`, onClear: clear });
        break;
      }
      case 'daterange': {
        const range = value as DateRangeValue;
        chips.push({
          key: def.key,
          label: `${def.label}: ${range.start || '...'} — ${range.end || '...'}`,
          onClear: clear,
        });
        break;
      }
      case 'numberrange': {
        const range = value as NumberRangeValue;
        chips.push({
          key: def.key,
          label: `${def.label}: ${range.min || '...'} — ${range.max || '...'}`,
          onClear: clear,
        });
        break;
      }
    }
  });

  const persistVisibility = (next: Record<string, boolean>) => {
    setColumnVisibility(next);
    localStorage.setItem(visibilityStorageKey, JSON.stringify(next));
  };

  const toggleColumn = (key: string) => {
    const column = columns.find(c => c.key === key);
    if (column?.lockVisible) return;
    persistVisibility({ ...columnVisibility, [key]: !columnVisibility[key] });
  };

  const showAllColumns = () => {
    const next: Record<string, boolean> = {};
    columnKeys.forEach(k => {
      next[k] = true;
    });
    persistVisibility(next);
  };

  const resetColumnVisibility = () => {
    const next: Record<string, boolean> = {};
    columns.forEach(c => {
      next[c.key] = c.defaultVisible !== false || !!c.lockVisible;
    });
    persistVisibility(next);
  };

  const persistOrder = (next: string[]) => {
    setColumnOrder(next);
    localStorage.setItem(orderStorageKey, JSON.stringify(next));
  };

  const resetColumnOrder = () => {
    persistOrder([...columnKeys]);
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedColumn(key);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (key !== draggedColumn) setDragOverColumn(key);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedColumn || draggedColumn === targetKey) {
      setDraggedColumn(null);
      return;
    }
    const next = mergeOrder(columnOrder, columnKeys);
    const from = next.indexOf(draggedColumn);
    const to = next.indexOf(targetKey);
    if (from === -1 || to === -1) {
      setDraggedColumn(null);
      return;
    }
    next.splice(from, 1);
    next.splice(to, 0, draggedColumn);
    persistOrder(next);
    setDraggedColumn(null);
  };

  const handleColumnSort = (key: string) => {
    const column = columns.find(c => c.key === key);
    if (!column?.sortable || !column.sortValue) return;
    if (sortColumn === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
  };

  const orderedVisibleColumns = useMemo(
    () =>
      mergeOrder(columnOrder, columnKeys)
        .map(key => columns.find(c => c.key === key))
        .filter((c): c is NonNullable<typeof c> => !!c && columnVisibility[c.key] !== false),
    [columnOrder, columnKeys, columns, columnVisibility]
  );

  const toggleRow = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const currentPageIds = rows.map(getRowId);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every(id => selectedIds.includes(id));

  const toggleAllCurrentPage = () => {
    if (allCurrentPageSelected) {
      setSelectedIds(prev => prev.filter(id => !currentPageIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...currentPageIds])]);
    }
  };

  const clearSelection = () => setSelectedIds([]);

  return {
    columns,
    getRowId,
    rows,
    filteredRows,
    totalItems,
    totalPages,
    page: safePage,
    setPage,
    itemsPerPage,
    searchInput,
    setSearchInput,
    searching,
    filterDefs,
    filterValues,
    setFilterValue,
    clearFilters,
    activeFilterCount,
    chips,
    showFilters,
    setShowFilters,
    columnOrder,
    orderedVisibleColumns,
    columnVisibility,
    toggleColumn,
    showAllColumns,
    resetColumnVisibility,
    resetColumnOrder,
    showColumnSelector,
    setShowColumnSelector,
    drag: {
      draggedColumn,
      dragOverColumn,
      handleDragStart,
      handleDragEnd,
      handleDragOver,
      handleDragLeave,
      handleDrop,
    },
    sortColumn,
    sortDirection,
    handleColumnSort,
    selectedIds,
    setSelectedIds,
    toggleRow,
    toggleAllCurrentPage,
    clearSelection,
    allCurrentPageSelected,
  };
}
