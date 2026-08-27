import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { useThemeColor } from '../../../hooks/useThemeColor';
import type { AdminTableInstance, DateRangeValue } from './types';

const localDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const rangeFor = (preset: string): DateRangeValue | null => {
  const now = new Date();
  const today = localDate(now);
  const daysAgo = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return localDate(d);
  };
  switch (preset) {
    case 'today':
      return { start: today, end: today };
    case 'yesterday':
      return { start: daysAgo(1), end: daysAgo(1) };
    case '7d':
      return { start: daysAgo(6), end: today };
    case '30d':
      return { start: daysAgo(29), end: today };
    case 'month':
      return { start: `${today.slice(0, 8)}01`, end: today };
    default:
      return null;
  }
};

const PRESETS: { value: string; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
];

export function TimeFrameSelect<T>({
  table,
  filterKey,
  label = 'Time frame',
}: {
  table: AdminTableInstance<T>;
  filterKey: string;
  label?: string;
}) {
  const { themeColor } = useThemeColor();
  const current = table.filterValues[filterKey] as DateRangeValue | undefined;

  const active = useMemo(() => {
    if (!current || (!current.start && !current.end)) return 'all';
    const match = PRESETS.find(p => {
      const range = rangeFor(p.value);
      return range && range.start === current.start && range.end === current.end;
    });
    return match?.value ?? 'custom';
  }, [current]);

  return (
    <div className="bg-white p-3 sm:px-6 sm:py-4 rounded-xl shadow-sm border border-gray-100 mb-4 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 mr-1">
        <CalendarDays size={14} />
        {label}
      </span>
      {PRESETS.map(preset => (
        <button
          key={preset.value}
          type="button"
          onClick={() => {
            const range = preset.value === 'all' ? { start: '', end: '' } : rangeFor(preset.value);
            if (range) table.setFilterValue(filterKey, range);
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
            active === preset.value
              ? `border-${themeColor}-600 text-${themeColor}-700 bg-${themeColor}-50`
              : 'border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
        >
          {preset.label}
        </button>
      ))}
      {active === 'custom' && current && (
        <span
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border border-${themeColor}-600 text-${themeColor}-700 bg-${themeColor}-50`}
        >
          {current.start || '…'} → {current.end || '…'}
        </span>
      )}
    </div>
  );
}
