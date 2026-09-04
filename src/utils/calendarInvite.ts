export interface CalendarEventInput {
  uid: string;
  title: string;
  date?: string | null;
  time?: string | null;
  durationMinutes?: number;
  description?: string;
  location?: string;
  url?: string;
}

const dateOnly = (value?: string | null): string => (value ?? '').split('T')[0];

const pad = (n: number): string => String(n).padStart(2, '0');

const stamp = (d: Date): string =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

const utcStamp = (d: Date): string =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;

export const parseLocalDateTime = (date?: string | null, time?: string | null): Date | null => {
  const day = dateOnly(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;

  const [y, m, d] = day.split('-').map(Number);
  const [hh = 0, mm = 0] = (time ?? '').split(':').map(Number);
  const parsed = new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 0, Number.isFinite(mm) ? mm : 0, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const escapeText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

const fold = (line: string): string => {
  if (line.length <= 73) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 73));
  rest = rest.slice(73);
  while (rest.length > 72) {
    parts.push(' ' + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  if (rest.length) parts.push(' ' + rest);
  return parts.join('\r\n');
};

export const buildIcs = (input: CalendarEventInput): string | null => {
  const start = parseLocalDateTime(input.date, input.time);
  if (!start) return null;

  const end = new Date(start.getTime() + Math.max(15, input.durationMinutes ?? 120) * 60000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zap Zone//Customer Portal//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeText(input.uid)}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    input.description ? `DESCRIPTION:${escapeText(input.description)}` : null,
    input.location ? `LOCATION:${escapeText(input.location)}` : null,
    input.url ? `URL:${escapeText(input.url)}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((l): l is string => l !== null);

  return lines.map(fold).join('\r\n');
};

export const downloadIcs = (filename: string, ics: string): void => {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const bookingDurationMinutes = (duration?: number | string | null, unit?: string | null): number => {
  const n = Number(duration);
  if (!Number.isFinite(n) || n <= 0) return 120;
  return (unit ?? 'hours').startsWith('min') ? n : n * 60;
};
