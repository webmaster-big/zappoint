import React from 'react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { AdminTableInstance } from './types';

interface BulkActionsBarProps<T> {
  table: AdminTableInstance<T>;
  itemLabel?: string;
  children: React.ReactNode;
}

export function BulkActionsBar<T>({ table, itemLabel = 'record(s)', children }: BulkActionsBarProps<T>) {
  const { themeColor, fullColor } = useThemeColor();
  if (table.selectedIds.length === 0) return null;

  return (
    <div className={`bg-${themeColor}-50 p-4 rounded-lg mb-6 flex flex-wrap items-center gap-4`}>
      <span className={`text-${fullColor} font-medium`}>
        {table.selectedIds.length} {itemLabel} selected
      </span>
      <div className="flex gap-2 flex-wrap items-center">{children}</div>
      <button
        type="button"
        onClick={table.clearSelection}
        className="text-xs text-gray-500 hover:text-gray-700 ml-auto"
      >
        Clear selection
      </button>
    </div>
  );
}

export default BulkActionsBar;
