import React from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';
import Pagination from '../../ui/Pagination';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { AdminTableInstance } from './types';

interface AdminDataTableProps<T> {
  table: AdminTableInstance<T>;
  loading?: boolean;
  selectable?: boolean;
  renderActions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  itemLabel?: string;
  showReorderTip?: boolean;
}

const GRIP_ICON = (
  <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
  </svg>
);

export function AdminDataTable<T>({
  table,
  loading = false,
  selectable = false,
  renderActions,
  actionsHeader = 'Actions',
  emptyMessage = 'No records found',
  emptyState,
  onRowClick,
  rowClassName,
  itemLabel = 'results',
  showReorderTip = true,
}: AdminDataTableProps<T>) {
  const { themeColor, fullColor } = useThemeColor();
  const columnCount = table.orderedVisibleColumns.length + (selectable ? 1 : 0) + (renderActions ? 1 : 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {showReorderTip && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">
            <span className="font-medium">Tip:</span> Drag column headers to reorder
          </span>
          <button
            onClick={table.resetColumnOrder}
            className={`text-xs text-${themeColor}-600 hover:text-${fullColor} flex items-center gap-1`}
          >
            <RefreshCcw className="w-3 h-3" />
            Reset Order
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
            <tr>
              {selectable && (
                <th scope="col" className="px-4 py-3 font-medium w-12">
                  <input
                    type="checkbox"
                    checked={table.allCurrentPageSelected}
                    onChange={table.toggleAllCurrentPage}
                    className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                  />
                </th>
              )}
              {table.orderedVisibleColumns.map(column => {
                const isSortable = !!column.sortable && !!column.sortValue;
                const isActivelySorted = table.sortColumn === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    data-col-key={column.key}
                    onPointerDown={e => table.drag.handlePointerDown(e, column.key)}
                    onClick={() => isSortable && table.handleColumnSort(column.key)}
                    className={`px-4 py-3 font-medium select-none touch-none transition-all duration-150 ${
                      isSortable ? 'cursor-pointer hover:bg-gray-100' : 'cursor-grab active:cursor-grabbing'
                    } ${table.drag.draggedColumn === column.key ? 'opacity-50' : ''} ${
                      table.drag.dragOverColumn === column.key
                        ? `bg-${themeColor}-100 border-l-2 border-${themeColor}-400`
                        : ''
                    } ${isActivelySorted ? `bg-${themeColor}-50 text-${fullColor}` : ''} ${column.headerClassName || ''}`}
                  >
                    <div className="flex items-center gap-1">
                      <span>{column.label}</span>
                      {isSortable ? (
                        isActivelySorted ? (
                          table.sortDirection === 'asc' ? (
                            <ChevronUp className={`w-3.5 h-3.5 text-${fullColor}`} />
                          ) : (
                            <ChevronDown className={`w-3.5 h-3.5 text-${fullColor}`} />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-gray-300" />
                        )
                      ) : (
                        GRIP_ICON
                      )}
                    </div>
                  </th>
                );
              })}
              {renderActions && (
                <th scope="col" className="px-4 py-3 font-medium w-20">
                  {actionsHeader}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {Array.from({ length: columnCount }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.rows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-6 py-8 text-center text-gray-500">
                  {emptyState || emptyMessage}
                </td>
              </tr>
            ) : (
              table.rows.map(row => {
                const id = table.getRowId(row);
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''} ${
                      rowClassName ? rowClassName(row) : ''
                    }`}
                  >
                    {selectable && (
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={table.selectedIds.includes(id)}
                          onChange={() => table.toggleRow(id)}
                          className={`rounded border-gray-300 text-${fullColor} focus:ring-${themeColor}-600`}
                        />
                      </td>
                    )}
                    {table.orderedVisibleColumns.map(column => (
                      <td
                        key={column.key}
                        className={`px-4 py-3 ${
                          typeof column.cellClassName === 'function'
                            ? column.cellClassName(row)
                            : column.cellClassName || ''
                        }`}
                      >
                        {column.render(row)}
                      </td>
                    ))}
                    {renderActions && (
                      <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        {renderActions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && table.totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-100">
          <Pagination
            currentPage={table.page}
            totalPages={table.totalPages}
            onPageChange={table.setPage}
            totalItems={table.totalItems}
            itemsPerPage={table.itemsPerPage}
            itemLabel={itemLabel}
          />
        </div>
      )}
    </div>
  );
}

export default AdminDataTable;
