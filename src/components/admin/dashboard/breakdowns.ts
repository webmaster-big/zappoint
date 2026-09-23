import type { BreakdownItem } from '../../../services/MetricsService';

export const percentageOf = (count: number, total: number): number =>
  total > 0 ? Math.round((count / total) * 100) : 0;

export const buildBreakdown = (rows: Array<{ label: string; count: number }>): BreakdownItem[] => {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return rows
    .filter(row => row.count > 0)
    .map(row => ({ label: row.label, count: row.count, percentage: percentageOf(row.count, total) }));
};

export const rescaleBreakdown = (items: BreakdownItem[] | undefined, keys: string[]): BreakdownItem[] => {
  const wanted = keys.map(k => k.toLowerCase());
  const picked = (items ?? []).filter(item => wanted.includes(String(item.status ?? item.label).toLowerCase()));
  return buildBreakdown(picked.map(item => ({ label: item.label, count: item.count })));
};
