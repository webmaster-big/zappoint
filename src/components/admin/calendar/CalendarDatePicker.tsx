import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { michiganToday, dateKey } from '../../../utils/timeFormat';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface CalendarDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  themeColor?: string;
  fullColor?: string;
  highlight?: 'day' | 'week' | 'month';
  buttonClassName?: string;
  align?: 'left' | 'center' | 'right';
}

const mondayIndex = (date: Date): number => (date.getDay() + 6) % 7;

const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - mondayIndex(result));
  result.setHours(0, 0, 0, 0);
  return result;
};

const buildMonthGrid = (month: Date): (Date | null)[] => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < mondayIndex(firstDay); i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, monthIndex, day));
  return cells;
};

const CalendarDatePicker: React.FC<CalendarDatePickerProps> = ({
  value,
  onChange,
  label,
  themeColor = 'blue',
  fullColor = 'blue-600',
  highlight = 'day',
  buttonClassName,
  align = 'center',
}) => {
  const [open, setOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setPickerMonth(new Date(value.getFullYear(), value.getMonth(), 1));
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  const todayKey = useMemo(() => dateKey(michiganToday()), []);
  const cells = useMemo(() => buildMonthGrid(pickerMonth), [pickerMonth]);

  const selectedWeek = useMemo(() => {
    if (highlight !== 'week') return null;
    const start = startOfWeek(value);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end) };
  }, [highlight, value]);

  const isSelected = (date: Date): boolean => {
    const key = dateKey(date);
    if (highlight === 'month') {
      return date.getFullYear() === value.getFullYear() && date.getMonth() === value.getMonth();
    }
    if (highlight === 'week' && selectedWeek) {
      return key >= selectedWeek.start && key <= selectedWeek.end;
    }
    return key === dateKey(value);
  };

  const shiftMonth = (delta: number) => {
    setPickerMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const alignment =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-0 sm:left-1/2 sm:-translate-x-1/2';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Jump to a date"
        className={
          buttonClassName ??
          `flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-800 hover:bg-${themeColor}-50 transition-colors`
        }
      >
        <CalendarIcon className={`w-4 h-4 text-${fullColor} shrink-0`} />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose a date"
          className={`absolute top-full mt-2 ${alignment} z-50 w-[17rem] rounded-lg border border-gray-200 bg-white p-3 shadow-xl`}
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold text-gray-900">
              {pickerMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {WEEKDAYS.map((day, index) => (
              <div key={index} className="py-1 text-center text-[0.65rem] font-semibold uppercase text-gray-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((date, index) => {
              if (!date) return <div key={`pad-${index}`} />;
              const key = dateKey(date);
              const selected = isSelected(date);
              const isToday = key === todayKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChange(date);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-md text-sm tabular-nums transition ${
                    selected
                      ? `bg-${fullColor} text-white font-semibold`
                      : isToday
                        ? `bg-${themeColor}-50 text-${fullColor} font-semibold`
                        : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              onChange(michiganToday());
              setOpen(false);
            }}
            className={`mt-2 w-full rounded-lg border border-${themeColor}-200 bg-${themeColor}-50 py-1.5 text-sm font-medium text-${fullColor} transition hover:bg-${themeColor}-100`}
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
};

export default CalendarDatePicker;
