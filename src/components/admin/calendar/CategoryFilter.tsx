import React from 'react';
import { sourceOf } from './useCategoryFilter';
import type { CalendarCategory, CategoryFilterState, CategorySource } from './useCategoryFilter';

const TAB_CLASSES: Record<CategorySource | 'mixed', { on: string; off: string; count: string }> = {
  booking: {
    on: 'bg-blue-600 text-white border-blue-600',
    off: 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50',
    count: 'text-blue-400',
  },
  attraction: {
    on: 'bg-purple-600 text-white border-purple-600',
    off: 'bg-white text-purple-700 border-purple-200 hover:bg-purple-50',
    count: 'text-purple-400',
  },
  event: {
    on: 'bg-amber-600 text-white border-amber-600',
    off: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
    count: 'text-amber-500',
  },
  mixed: {
    on: 'bg-slate-700 text-white border-slate-700',
    off: 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50',
    count: 'text-slate-400',
  },
};

const SOURCE_HINT: Record<CategorySource | 'mixed', string> = {
  booking: 'package bookings',
  attraction: 'attraction tickets',
  event: 'event registrations',
  mixed: 'bookings and attraction tickets',
};

export const CalendarCategoryTabs: React.FC<{
  filter: CategoryFilterState;
  className?: string;
  size?: 'sm' | 'md';
  label?: string;
}> = ({ filter, className, size = 'md', label }) => {
  if (filter.categories.length < 2) return null;

  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-2.5 py-1 text-xs sm:px-3.5 sm:py-1.5 sm:text-sm';
  const total = filter.categories.reduce((sum, category) => sum + category.count, 0);

  const tab = (category: CalendarCategory) => {
    const on = filter.selected.includes(category.key);
    const tone = TAB_CLASSES[sourceOf(category)];

    return (
      <button
        key={category.key}
        type="button"
        onClick={() => filter.toggle(category.key)}
        aria-pressed={on}
        title={`${category.count} ${SOURCE_HINT[sourceOf(category)]} in ${category.label}`}
        className={`rounded-full border font-medium transition-colors ${pad} ${on ? tone.on : tone.off}`}
      >
        {category.label}
        <span className={`ml-1.5 tabular-nums ${on ? 'text-white/80' : tone.count}`}>{category.count}</span>
      </button>
    );
  };

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className ?? ''}`}
      role="group"
      aria-label={label ?? 'Filter the calendar by category'}
    >
      {label && <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</span>}
      <button
        type="button"
        onClick={filter.showAll}
        aria-pressed={filter.isAll}
        title={`Show all ${total} scheduled items`}
        className={`rounded-full border font-medium transition-colors ${pad} ${
          filter.isAll
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        }`}
      >
        All
        <span className={`ml-1.5 tabular-nums ${filter.isAll ? 'text-white/80' : 'text-gray-400'}`}>{total}</span>
      </button>
      {filter.categories.map(tab)}
    </div>
  );
};

export default CalendarCategoryTabs;
