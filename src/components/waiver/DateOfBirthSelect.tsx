import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 1900 + 1 }, (_, i) => CURRENT_YEAR - i);

const daysInMonth = (year: number, month: number): number => {
  if (!month) return 31;
  return new Date(year || 2000, month, 0).getDate();
};

const parse = (value: string): { year: number; month: number; day: number } => {
  const [y, m, d] = (value || '').split('T')[0].split('-');
  return { year: y ? Number(y) : 0, month: m ? Number(m) : 0, day: d ? Number(d) : 0 };
};

const DateOfBirthSelect = ({ value, onChange, error }: Props) => {
  const initial = parse(value);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  const emitted = useRef(value);

  useEffect(() => {
    if (value === emitted.current) return;
    const p = parse(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
    emitted.current = value;
  }, [value]);

  const commit = (y: number, m: number, d: number) => {
    const clampedDay = m && d ? Math.min(d, daysInMonth(y, m)) : d;
    setYear(y);
    setMonth(m);
    setDay(clampedDay);
    const next = y && m && clampedDay
      ? `${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
      : '';
    emitted.current = next;
    onChange(next);
  };

  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1);

  const selectClass = `w-full px-2 py-2 border rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition ${
    error ? 'border-red-300' : 'border-gray-200'
  }`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className={selectClass} value={month || ''} onChange={(e) => commit(year, Number(e.target.value), day)}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select className={selectClass} value={day || ''} onChange={(e) => commit(year, month, Number(e.target.value))}>
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className={selectClass} value={year || ''} onChange={(e) => commit(Number(e.target.value), month, day)}>
        <option value="">Year</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default DateOfBirthSelect;
