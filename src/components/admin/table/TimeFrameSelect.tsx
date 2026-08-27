import { useMemo } from 'react';
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

  const value = useMemo(() => {
    if (!current || (!current.start && !current.end)) return 'all';
    const match = PRESETS.find(p => {
      const range = rangeFor(p.value);
      return range && range.start === current.start && range.end === current.end;
    });
    return match?.value ?? 'custom';
  }, [current]);

  return (
    <select
      aria-label={label}
      title={label}
      value={value}
      onChange={e => {
        const preset = e.target.value;
        if (preset === 'all') {
          table.setFilterValue(filterKey, { start: '', end: '' });
          return;
        }
        const range = rangeFor(preset);
        if (range) table.setFilterValue(filterKey, range);
      }}
      className={`border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:ring-2 focus:ring-${themeColor}-600 focus:border-${themeColor}-600`}
    >
      {PRESETS.map(preset => (
        <option key={preset.value} value={preset.value}>
          {preset.label}
        </option>
      ))}
      {value === 'custom' && (
        <option value="custom" disabled>
          Custom range
        </option>
      )}
    </select>
  );
}
