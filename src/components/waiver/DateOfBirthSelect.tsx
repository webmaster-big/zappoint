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
  if (!year || !month) return 31;
  return new Date(year, month, 0).getDate();
};

const DateOfBirthSelect = ({ value, onChange, error }: Props) => {
  const [yRaw, mRaw, dRaw] = (value || '').split('T')[0].split('-');
  const year = yRaw ? Number(yRaw) : 0;
  const month = mRaw ? Number(mRaw) : 0;
  const day = dRaw ? Number(dRaw) : 0;

  const emit = (y: number, m: number, d: number) => {
    if (!y || !m || !d) {
      onChange('');
      return;
    }
    const clampedDay = Math.min(d, daysInMonth(y, m));
    onChange(`${y}-${String(m).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`);
  };

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const selectClass = `w-full px-2 py-2 border rounded-lg bg-gray-50/50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition ${
    error ? 'border-red-300' : 'border-gray-200'
  }`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <select className={selectClass} value={month || ''} onChange={(e) => emit(year, Number(e.target.value), day)}>
        <option value="">Month</option>
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>{name}</option>
        ))}
      </select>
      <select className={selectClass} value={day || ''} onChange={(e) => emit(year, month, Number(e.target.value))}>
        <option value="">Day</option>
        {days.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </select>
      <select className={selectClass} value={year || ''} onChange={(e) => emit(Number(e.target.value), month, day)}>
        <option value="">Year</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
};

export default DateOfBirthSelect;
