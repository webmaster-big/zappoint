import type { ReactNode } from 'react';

export interface AdminColumn<T> {
  key: string;
  label: string;
  group?: string;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  defaultVisible?: boolean;
  lockVisible?: boolean;
  render: (row: T) => ReactNode;
  exportValue?: (row: T) => string | number | null | undefined;
  headerClassName?: string;
  cellClassName?: string | ((row: T) => string);
}

export interface FilterOption {
  value: string;
  label: string;
}

interface BaseFilterDef {
  key: string;
  label: string;
}

export interface SelectFilterDef<T> extends BaseFilterDef {
  type: 'select';
  options: FilterOption[];
  allLabel?: string;
  predicate: (row: T, value: string) => boolean;
}

export interface MultiSelectFilterDef<T> extends BaseFilterDef {
  type: 'multiselect';
  options: FilterOption[];
  predicate: (row: T, values: string[]) => boolean;
}

export interface DateRangeFilterDef<T> extends BaseFilterDef {
  type: 'daterange';
  getDate: (row: T) => string | null | undefined;
}

export interface NumberRangeFilterDef<T> extends BaseFilterDef {
  type: 'numberrange';
  getValue: (row: T) => number;
}

export type AdminFilterDef<T> =
  | SelectFilterDef<T>
  | MultiSelectFilterDef<T>
  | DateRangeFilterDef<T>
  | NumberRangeFilterDef<T>;

export interface DateRangeValue {
  start: string;
  end: string;
}

export interface NumberRangeValue {
  min: string;
  max: string;
}

export type FilterValue = string | string[] | DateRangeValue | NumberRangeValue;

export interface FilterChip {
  key: string;
  label: string;
  onClear: () => void;
}

export type SortDirection = 'asc' | 'desc';

export interface AdminTableConfig<T> {
  data: T[];
  columns: AdminColumn<T>[];
  getRowId: (row: T) => string;
  storageKey: string;
  filterDefs?: AdminFilterDef<T>[];
  searchFields?: (row: T) => Array<string | number | null | undefined>;
  serverSearch?: (term: string) => Promise<T[] | null>;
  serverSearchMinLength?: number;
  defaultSort?: (a: T, b: T) => number;
  itemsPerPage?: number;
}

export interface ColumnDragState {
  draggedColumn: string | null;
  dragOverColumn: string | null;
  handleDragStart: (e: React.DragEvent, key: string) => void;
  handleDragEnd: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent, key: string) => void;
  handleDragLeave: () => void;
  handleDrop: (e: React.DragEvent, key: string) => void;
}

export interface AdminTableInstance<T> {
  columns: AdminColumn<T>[];
  getRowId: (row: T) => string;
  rows: T[];
  filteredRows: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  setPage: (page: number) => void;
  itemsPerPage: number;
  searchInput: string;
  setSearchInput: (value: string) => void;
  searching: boolean;
  filterDefs: AdminFilterDef<T>[];
  filterValues: Record<string, FilterValue>;
  setFilterValue: (key: string, value: FilterValue) => void;
  clearFilters: () => void;
  activeFilterCount: number;
  chips: FilterChip[];
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
  columnOrder: string[];
  orderedVisibleColumns: AdminColumn<T>[];
  columnVisibility: Record<string, boolean>;
  toggleColumn: (key: string) => void;
  showAllColumns: () => void;
  resetColumnVisibility: () => void;
  resetColumnOrder: () => void;
  showColumnSelector: boolean;
  setShowColumnSelector: (show: boolean) => void;
  drag: ColumnDragState;
  sortColumn: string | null;
  sortDirection: SortDirection;
  handleColumnSort: (key: string) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleRow: (id: string) => void;
  toggleAllCurrentPage: () => void;
  clearSelection: () => void;
  allCurrentPageSelected: boolean;
}
