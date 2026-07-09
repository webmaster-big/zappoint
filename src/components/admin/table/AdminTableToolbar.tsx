import React, { useEffect, useRef } from 'react';
import { Columns, EyeOff, Filter, RefreshCcw, Search, X } from 'lucide-react';
import StandardButton from '../../ui/StandardButton';
import DateRangeCalendar from '../../ui/DateRangeCalendar';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { AdminTableInstance, DateRangeValue, NumberRangeValue } from './types';

interface AdminTableToolbarProps<T> {
  table: AdminTableInstance<T>;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  filterPanelExtra?: React.ReactNode;
}

export function AdminTableToolbar<T>({
  table,
  searchPlaceholder = 'Search...',
  onRefresh,
  actions,
  filterPanelExtra,
}: AdminTableToolbarProps<T>) {
  const { themeColor, fullColor } = useThemeColor();
  const columnSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!table.showColumnSelector) return;
    const handleClick = (e: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(e.target as Node)) {
        table.setShowColumnSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [table.showColumnSelector]);

  const groups = new Map<string, typeof table.columns>();
  table.columns.forEach(column => {
    const group = column.group || 'Columns';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(column);
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-lg w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-600" />
          </div>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={table.searchInput}
            onChange={e => table.setSearchInput(e.target.value)}
            className={`pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg w-full text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
          />
          {table.searching && (
            <div className="absolute inset-y-0 right-3 flex items-center">
              <div className={`w-3.5 h-3.5 border-2 border-${themeColor}-600 border-t-transparent rounded-full animate-spin`} />
            </div>
          )}
        </div>
        <div className="flex gap-1 flex-wrap">
          {table.filterDefs.length > 0 && (
            <StandardButton
              variant="secondary"
              size="sm"
              icon={Filter}
              onClick={() => table.setShowFilters(!table.showFilters)}
            >
              Filters
              {table.activeFilterCount > 0 && (
                <span className={`ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-${themeColor}-600 text-white`}>
                  {table.activeFilterCount}
                </span>
              )}
            </StandardButton>
          )}
          <div className="relative" ref={columnSelectorRef}>
            <StandardButton
              variant="secondary"
              size="sm"
              icon={table.showColumnSelector ? EyeOff : Columns}
              onClick={() => table.setShowColumnSelector(!table.showColumnSelector)}
            >
              Columns
            </StandardButton>
            {table.showColumnSelector && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-3 max-h-[80vh] overflow-y-auto">
                <div className="text-xs font-semibold text-gray-700 mb-2">Toggle Columns</div>
                {[...groups.entries()].map(([group, columns]) => (
                  <div key={group} className="mb-2">
                    {groups.size > 1 && (
                      <div className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-1">{group}</div>
                    )}
                    {columns.map(column => (
                      <label
                        key={column.key}
                        className={`flex items-center gap-2 p-1 rounded text-sm ${column.lockVisible ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={table.columnVisibility[column.key] !== false}
                          disabled={column.lockVisible}
                          onChange={() => table.toggleColumn(column.key)}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`}
                        />
                        <span className="text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-gray-100 flex gap-2">
                  <button
                    onClick={table.showAllColumns}
                    className={`text-xs text-${themeColor}-600 hover:text-${themeColor}-800`}
                  >
                    Show All
                  </button>
                  <button
                    onClick={table.resetColumnVisibility}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </div>
          {onRefresh && (
            <StandardButton variant="secondary" size="sm" icon={RefreshCcw} onClick={onRefresh}>
              {''}
            </StandardButton>
          )}
          {actions}
        </div>
      </div>

      {table.chips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {table.chips.map(chip => (
            <span
              key={chip.key}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${themeColor}-50 text-${themeColor}-700 border border-${themeColor}-200`}
            >
              {chip.label}
              <button type="button" onClick={chip.onClear} className={`hover:text-${themeColor}-900 ml-0.5`}>
                <X size={11} />
              </button>
            </span>
          ))}
          {table.chips.length > 1 && (
            <button type="button" onClick={table.clearFilters} className="text-xs text-gray-500 hover:text-gray-700 ml-1">
              Clear all
            </button>
          )}
        </div>
      )}

      {table.showFilters && table.filterDefs.length > 0 && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {table.filterDefs.map(def => {
              const value = table.filterValues[def.key];
              switch (def.type) {
                case 'select':
                  return (
                    <div key={def.key}>
                      <label className="block text-xs font-medium text-gray-800 mb-1">{def.label}</label>
                      <select
                        value={(value as string) ?? 'all'}
                        onChange={e => table.setFilterValue(def.key, e.target.value || 'all')}
                        className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                      >
                        <option value="all">{def.allLabel || `All ${def.label}`}</option>
                        {def.options.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                case 'multiselect':
                  return (
                    <div key={def.key}>
                      <label className="block text-xs font-medium text-gray-800 mb-1">{def.label}</label>
                      <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white p-2 space-y-1">
                        {def.options.map(option => {
                          const values = (value as string[]) ?? [];
                          return (
                            <label key={option.value} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-0.5 rounded text-sm">
                              <input
                                type="checkbox"
                                checked={values.includes(option.value)}
                                onChange={() => {
                                  const next = values.includes(option.value)
                                    ? values.filter(v => v !== option.value)
                                    : [...values, option.value];
                                  table.setFilterValue(def.key, next);
                                }}
                                className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600 w-3.5 h-3.5`}
                              />
                              <span className="text-gray-700">{option.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                case 'daterange': {
                  const range = (value as DateRangeValue) ?? { start: '', end: '' };
                  return (
                    <div key={def.key}>
                      <label className="block text-xs font-medium text-gray-800 mb-1">{def.label}</label>
                      <DateRangeCalendar
                        startDate={range.start}
                        endDate={range.end}
                        onChange={(start, end) => table.setFilterValue(def.key, { start, end })}
                        themeColor={themeColor}
                      />
                    </div>
                  );
                }
                case 'numberrange': {
                  const range = (value as NumberRangeValue) ?? { min: '', max: '' };
                  return (
                    <div key={def.key}>
                      <label className="block text-xs font-medium text-gray-800 mb-1">{def.label}</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Min"
                          value={range.min}
                          onChange={e => table.setFilterValue(def.key, { ...range, min: e.target.value })}
                          className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                        <input
                          type="number"
                          placeholder="Max"
                          value={range.max}
                          onChange={e => table.setFilterValue(def.key, { ...range, max: e.target.value })}
                          className={`w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
                        />
                      </div>
                    </div>
                  );
                }
                default:
                  return null;
              }
            })}
            {filterPanelExtra}
          </div>
          <div className="mt-3 flex justify-end">
            <StandardButton variant="ghost" size="sm" onClick={table.clearFilters}>
              Clear Filters
            </StandardButton>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTableToolbar;
