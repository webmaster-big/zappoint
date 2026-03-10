import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Calendar } from 'lucide-react';

interface DateRangeCalendarProps {
  startDate: string; // YYYY-MM-DD or ''
  endDate: string;   // YYYY-MM-DD or ''
  onChange: (start: string, end: string) => void;
  themeColor?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatShortDate = (dateStr: string) => {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const DateRangeCalendar: React.FC<DateRangeCalendarProps> = ({
  startDate,
  endDate,
  onChange,
  themeColor = 'blue',
}) => {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(
    startDate ? new Date(startDate + 'T00:00:00').getMonth() : now.getMonth()
  );
  const [viewYear, setViewYear] = useState(
    startDate ? new Date(startDate + 'T00:00:00').getFullYear() : now.getFullYear()
  );
  const [picking, setPicking] = useState<'start' | 'end'>(startDate && !endDate ? 'end' : 'start');
  const [hoveredDate, setHoveredDate] = useState<string>('');

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleDayClick = (dateStr: string) => {
    if (picking === 'start') {
      onChange(dateStr, '');
      setPicking('end');
    } else {
      if (startDate && dateStr < startDate) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
      setPicking('start');
      setOpen(false);
    }
  };

  const handleClear = () => {
    onChange('', '');
    setPicking('start');
    setHoveredDate('');
  };

  const isInRange = (dateStr: string) => {
    if (!startDate) return false;
    const rangeEnd = endDate || (picking === 'end' ? hoveredDate : '');
    if (!rangeEnd) return false;
    const lo = startDate < rangeEnd ? startDate : rangeEnd;
    const hi = startDate < rangeEnd ? rangeEnd : startDate;
    return dateStr >= lo && dateStr <= hi;
  };

  const todayStr = toDateStr(now);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Trigger button label
  const hasRange = startDate && endDate;
  const hasPartial = startDate && !endDate;
  const triggerLabel = hasRange
    ? `${formatShortDate(startDate)} — ${formatShortDate(endDate)}`
    : hasPartial
      ? `${formatShortDate(startDate)} — …`
      : 'Select dates';

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 border rounded-lg px-2 py-1.5 text-sm transition-colors ${
          open ? `border-${themeColor}-400 ring-2 ring-${themeColor}-100` : 'border-gray-200 hover:border-gray-300'
        } bg-white`}
      >
        <Calendar size={14} className="text-gray-400 flex-shrink-0" />
        <span className={hasRange ? 'text-gray-800 font-medium' : 'text-gray-400'}>{triggerLabel}</span>
        {(startDate || endDate) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="ml-auto text-gray-300 hover:text-gray-500 transition"
          >
            <X size={13} />
          </button>
        )}
      </button>

      {/* Popover Calendar */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 p-3 w-[260px] right-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 transition">
              <ChevronLeft size={14} className="text-gray-600" />
            </button>
            <span className="text-xs font-semibold text-gray-800">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 transition">
              <ChevronRight size={14} className="text-gray-600" />
            </button>
          </div>

          {/* Picking hint */}
          <p className="text-[10px] text-center text-gray-400 mb-1.5">
            {picking === 'start' ? 'Select start date' : 'Select end date'}
          </p>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-0.5">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e-${i}`} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isStart = dateStr === startDate;
              const isEnd = dateStr === endDate;
              const inRange = isInRange(dateStr);
              const isToday = dateStr === todayStr;

              let cellClass = 'text-gray-700 hover:bg-gray-100';
              if (isStart || isEnd) {
                cellClass = `bg-${themeColor}-600 text-white font-bold`;
              } else if (inRange) {
                cellClass = `bg-${themeColor}-50 text-${themeColor}-700`;
              }

              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  onMouseEnter={() => { if (picking === 'end') setHoveredDate(dateStr); }}
                  className={`w-full aspect-square flex items-center justify-center text-[11px] rounded-md cursor-pointer transition-colors ${cellClass} ${isToday && !isStart && !isEnd ? 'ring-1 ring-gray-300' : ''}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer: range summary */}
          {(startDate || endDate) && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                {startDate && !endDate && <span className="text-gray-600 font-medium">Pick end date…</span>}
                {startDate && endDate && (
                  <>
                    {formatShortDate(startDate)} — {new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </>
                )}
              </span>
              <button type="button" onClick={handleClear} className="text-[10px] text-gray-400 hover:text-gray-600 transition">
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DateRangeCalendar;
