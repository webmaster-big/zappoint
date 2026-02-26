import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import StandardButton from './StandardButton';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Total number of items (used for "Showing X to Y of Z" text) */
  totalItems?: number;
  /** Items per page (used for "Showing X to Y of Z" text) */
  itemsPerPage?: number;
  /** Label for the items, e.g. "results", "activities", "payments" */
  itemLabel?: string;
  /** Override the starting index (1-based) for "Showing X to Y" display when items come from server pagination */
  showingFrom?: number;
  /** Override the ending index for "Showing X to Y" display when items come from server pagination */
  showingTo?: number;
  /** Use compact layout (no "Showing" text, icon-only nav) — used for customer pages */
  compact?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * Generates an array of page numbers and ellipsis markers to display.
 * Shows: first page, last page, current page, and 1 page on each side of current.
 * Ellipsis ("...") is inserted where pages are skipped.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | '...')[] = [];
  const rangeStart = Math.max(2, currentPage - 1);
  const rangeEnd = Math.min(totalPages - 1, currentPage + 1);

  // Always show first page
  pages.push(1);

  // Ellipsis after first page if needed
  if (rangeStart > 2) {
    pages.push('...');
  }

  // Pages around current
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Ellipsis before last page if needed
  if (rangeEnd < totalPages - 1) {
    pages.push('...');
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  itemsPerPage,
  itemLabel = 'results',
  showingFrom,
  showingTo,
  compact = false,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  // Calculate "Showing X to Y of Z" values
  const from = showingFrom ?? (itemsPerPage ? (currentPage - 1) * itemsPerPage + 1 : undefined);
  const to = showingTo ?? (itemsPerPage && totalItems ? Math.min(currentPage * itemsPerPage, totalItems) : undefined);

  if (compact) {
    return (
      <div className={`flex items-center justify-between ${className}`}>
        {totalItems !== undefined && from !== undefined && to !== undefined && (
          <span className="text-xs text-gray-400">
            {from}–{to} of {totalItems}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition"
          >
            <ChevronLeft size={14} className="text-gray-600" />
          </button>
          {pages.map((p, i) =>
            typeof p === 'string' ? (
              <span key={`dots-${i}`} className="px-1 text-gray-400 text-xs select-none">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 text-xs font-semibold rounded-lg transition ${
                  currentPage === p
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-1.5 rounded-lg disabled:opacity-30 hover:bg-gray-100 transition"
          >
            <ChevronRight size={14} className="text-gray-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 ${className}`}>
      {totalItems !== undefined && from !== undefined && to !== undefined && (
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{from}</span> to{' '}
          <span className="font-medium">{to}</span>{' '}
          of <span className="font-medium">{totalItems}</span> {itemLabel}
        </div>
      )}
      <div className="flex gap-2">
        <StandardButton
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          variant="secondary"
          size="sm"
        >
          Previous
        </StandardButton>

        {pages.map((p, i) =>
          typeof p === 'string' ? (
            <span key={`dots-${i}`} className="px-2 py-1.5 text-gray-400 text-sm select-none">
              …
            </span>
          ) : (
            <StandardButton
              key={p}
              onClick={() => onPageChange(p)}
              variant={currentPage === p ? 'primary' : 'secondary'}
              size="sm"
            >
              {p}
            </StandardButton>
          )
        )}

        <StandardButton
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          variant="secondary"
          size="sm"
        >
          Next
        </StandardButton>
      </div>
    </div>
  );
};

export default Pagination;
