import type { AdminColumn } from './types';

const escapeCell = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCsv = (headers: string[], rows: Array<Array<string | number | null | undefined>>): string => {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return '\uFEFF' + lines.join('\r\n');
};

export const downloadCsv = (filename: string, csv: string): void => {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export interface ExtraExportColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export const exportTableCsv = <T,>(options: {
  filename: string;
  columns: AdminColumn<T>[];
  rows: T[];
  extraColumns?: ExtraExportColumn<T>[];
}): void => {
  const exportable = options.columns.filter(c => c.exportValue || c.sortValue);
  const headers = [
    ...exportable.map(c => c.label),
    ...(options.extraColumns || []).map(c => c.label),
  ];
  const rows = options.rows.map(row => [
    ...exportable.map(c => (c.exportValue ? c.exportValue(row) : c.sortValue!(row))),
    ...(options.extraColumns || []).map(c => c.value(row)),
  ]);
  downloadCsv(options.filename, toCsv(headers, rows));
};
