import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, CheckCircle } from 'lucide-react';

interface AvailabilitySlot {
  days: string[];
  start_time: string;
  end_time: string;
}

interface ScheduleCalendarProps {
  availability: AvailabilitySlot[];
  dayOffDates: Set<string>; // Set of 'YYYY-MM-DD' strings
  scheduledDate: string;
  scheduledTime: string;
  availableTimeSlots: string[];
  onDateSelect: (dateStr: string) => void;
  onTimeSelect: (time: string) => void;
  themeColor?: string;
  compact?: boolean; // For admin panels with less space
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NUMBER_TO_NAME = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const formatTime12Hour = (time24: string): string => {
  const [h24, minutes] = time24.split(':');
  const hours = parseInt(h24, 10);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${period}`;
};

const ScheduleCalendar: React.FC<ScheduleCalendarProps> = ({
  availability,
  dayOffDates,
  scheduledDate,
  scheduledTime,
  availableTimeSlots,
  onDateSelect,
  onTimeSelect,
  themeColor = 'blue',
  compact = false,
}) => {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Available day names (lowercase) from availability slots
  const availableDayNames = useMemo(() => {
    const days = new Set<string>();
    availability.forEach(slot => {
      slot.days.forEach(d => days.add(d.toLowerCase()));
    });
    return days;
  }, [availability]);

  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Check if a date is selectable
  const isDateSelectable = useMemo(() => {
    return (date: Date): boolean => {
      if (date < today) return false;
      const dayName = DAY_NUMBER_TO_NAME[date.getDay()];
      if (availableDayNames.size > 0 && !availableDayNames.has(dayName)) return false;
      const dateStr = formatDateStr(date);
      if (dayOffDates.has(dateStr)) return false;
      return true;
    };
  }, [today, availableDayNames, dayOffDates]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{
      date: Date | null;
      selectable: boolean;
      isToday: boolean;
      isSelected: boolean;
      isDayOff: boolean;
      isPast: boolean;
    }> = [];

    for (let i = 0; i < startPad; i++) {
      days.push({ date: null, selectable: false, isToday: false, isSelected: false, isDayOff: false, isPast: false });
    }

    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = formatDateStr(date);
      const selectable = isDateSelectable(date);
      const isToday = dateStr === formatDateStr(today);
      const isSelected = dateStr === scheduledDate;
      const isDayOff = dayOffDates.has(dateStr);
      const isPast = date < today;
      days.push({ date, selectable, isToday, isSelected, isDayOff, isPast });
    }

    return days;
  }, [viewYear, viewMonth, scheduledDate, today, isDateSelectable, dayOffDates]);

  const monthName = new Date(viewYear, viewMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const canGoPrev = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());

  // Highlighted available day columns (0-6 index)
  const availableDayIndices = useMemo(() => {
    const indices = new Set<number>();
    availableDayNames.forEach(name => {
      const idx = DAY_NUMBER_TO_NAME.indexOf(name);
      if (idx >= 0) indices.add(idx);
    });
    return indices;
  }, [availableDayNames]);

  const availableDaysDisplay = useMemo(() => {
    return [...availableDayNames].map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
  }, [availableDayNames]);

  // Calendar section
  const calendarSection = (
    <div className={compact ? 'p-2.5' : 'p-3'}>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-2.5">
        <button
          type="button"
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-600" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{monthName}</span>
        <button
          type="button"
          onClick={goToNextMonth}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {/* Day headers — highlight available days */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_NAMES.map((name, idx) => (
          <div
            key={name}
            className={`text-center text-[10px] font-bold uppercase py-1 rounded
              ${availableDayIndices.has(idx)
                ? `text-${themeColor}-700 bg-${themeColor}-50`
                : 'text-gray-400'
              }`}
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {calendarDays.map((day, idx) => {
          if (!day.date) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateNum = day.date.getDate();

          // Unavailable / past / day-off dates
          if (!day.selectable) {
            return (
              <div
                key={idx}
                className={`aspect-square flex items-center justify-center text-[11px] rounded-lg cursor-not-allowed
                  ${day.isDayOff
                    ? 'bg-red-50 text-red-300 line-through'
                    : 'text-gray-300'
                  }`}
                title={day.isDayOff ? 'Day off — unavailable' : day.isPast ? 'Past date' : 'Not available'}
              >
                {dateNum}
              </div>
            );
          }

          // Available selectable dates — highlighted with subtle bg and dot
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onDateSelect(formatDateStr(day.date!))}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg font-medium transition-all relative
                ${day.isSelected
                  ? `bg-${themeColor}-600 text-white shadow-md ring-2 ring-${themeColor}-200`
                  : day.isToday
                  ? `bg-${themeColor}-100 text-${themeColor}-800 font-bold ring-1 ring-${themeColor}-300 hover:bg-${themeColor}-200`
                  : `text-gray-800 bg-${themeColor}-50/60 hover:bg-${themeColor}-100 hover:shadow-sm`
                }
                text-[11px]`}
              title={day.isToday ? 'Today' : undefined}
            >
              {dateNum}
              {/* Available indicator dot */}
              {!day.isSelected && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${day.isToday ? `bg-${themeColor}-600` : `bg-${themeColor}-400`}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 pt-2 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-sm bg-${themeColor}-50 ring-1 ring-${themeColor}-200`} />
          <span className="text-[9px] text-gray-500">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-sm bg-${themeColor}-600`} />
          <span className="text-[9px] text-gray-500">Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-red-100 border border-red-200" />
          <span className="text-[9px] text-gray-500">Day Off</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm bg-gray-100" />
          <span className="text-[9px] text-gray-500">Unavailable</span>
        </div>
      </div>
    </div>
  );

  // Time slot section
  const timeSection = (
    <div className={compact ? 'p-2.5' : 'p-3'}>
      <label className="block text-xs font-semibold text-gray-700 mb-2">
        {scheduledDate ? 'Select a Time' : 'Pick a date first'}
      </label>

      {!scheduledDate ? (
        <div className="flex items-center justify-center py-6 text-gray-400">
          <div className="text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Select a date to see available times</p>
          </div>
        </div>
      ) : availableTimeSlots.length > 0 ? (
        <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'} gap-1.5`}>
          {availableTimeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => onTimeSelect(time)}
              className={`px-2 py-2.5 text-xs rounded-lg font-medium transition-all border
                ${scheduledTime === time
                  ? `bg-${themeColor}-600 text-white border-${themeColor}-600 shadow-sm`
                  : `bg-white text-gray-700 border-gray-200 hover:border-${themeColor}-300 hover:bg-${themeColor}-50`
                }`}
            >
              {formatTime12Hour(time)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-orange-600 bg-orange-50 rounded-lg p-2.5 border border-orange-100">
          No time slots available for this date.
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-4 py-2.5 bg-${themeColor}-50 border-b border-${themeColor}-100`}>
        <div className="flex items-center gap-2">
          <Clock className={`h-4 w-4 text-${themeColor}-600`} />
          <h3 className="text-sm font-semibold text-gray-900">Schedule Your Visit</h3>
          <span className="text-[10px] text-gray-400 ml-auto">(Optional)</span>
        </div>
        {availableDaysDisplay && (
          <p className="text-[11px] text-gray-500 mt-0.5">
            Available: <span className="font-medium text-gray-700">{availableDaysDisplay}</span>
          </p>
        )}
      </div>

      {/* Mobile: stacked | Desktop: side-by-side */}
      <div className={`flex flex-col ${compact ? '' : 'md:flex-row'}`}>
        {/* Calendar side */}
        <div className={`${compact ? 'w-full' : 'w-full md:w-[55%]'} ${compact ? '' : 'md:border-r'} border-gray-100`}>
          {calendarSection}
        </div>
        {/* Time side */}
        <div className={`${compact ? 'w-full border-t' : 'w-full md:w-[45%] border-t md:border-t-0'} border-gray-100`}>
          {timeSection}
        </div>
      </div>

      {/* Confirmation */}
      {scheduledDate && scheduledTime && (
        <div className="px-3 pb-3">
          <div className="p-2.5 bg-green-50 rounded-lg border border-green-200 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
            <p className="text-xs text-green-800">
              <strong>{new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong> at <strong>{formatTime12Hour(scheduledTime)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleCalendar;
