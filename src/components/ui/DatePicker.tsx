import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';

interface BreakTime {
  days: string[];
  start_time: string;
  end_time: string;
}

// Extended day off type with time information for partial closures
interface DayOffInfo {
  date: Date;
  time_start?: string | null;  // Closes at this time (e.g., "16:00")
  time_end?: string | null;    // Opens at this time (e.g., "12:00")
  reason?: string;
}

interface DatePickerProps {
  selectedDate: string; // ISO date string (YYYY-MM-DD)
  availableDates: Date[];
  onChange: (date: string) => void;
  breakTimes?: BreakTime[]; // Optional break times to show which days have breaks
  dayOffs?: Date[]; // Optional day offs (holidays, blocked dates) - full day only (legacy)
  dayOffsWithTime?: DayOffInfo[]; // Day offs with partial closure support
}

const DatePicker: React.FC<DatePickerProps> = ({
  selectedDate,
  availableDates,
  onChange,
  breakTimes = [],
  dayOffs = [],
  dayOffsWithTime = []
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(
    selectedDate ? new Date(selectedDate) : new Date()
  );

  useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(new Date(selectedDate));
    }
  }, [selectedDate]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const firstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const isDateAvailable = (date: Date) => {
    return availableDates.some(availableDate => {
      return availableDate.toDateString() === date.toDateString();
    });
  };

  // Check if a date is a day off (full day only - legacy support)
  const isDayOff = (date: Date) => {
    return dayOffs.some(dayOff => {
      return dayOff.toDateString() === date.toDateString();
    });
  };

  // Check if a date is a FULL day off (no time_start and time_end)
  const isFullDayOff = (date: Date): boolean => {
    // Check legacy dayOffs first
    if (isDayOff(date)) return true;
    
    // Check dayOffsWithTime for full day closures
    const dayOffInfo = dayOffsWithTime.find(d => d.date.toDateString() === date.toDateString());
    if (dayOffInfo) {
      // Full day off if neither time_start nor time_end is set
      return !dayOffInfo.time_start && !dayOffInfo.time_end;
    }
    return false;
  };

  // Check if a date has a partial day off (has time restrictions)
  const hasPartialDayOff = (date: Date): DayOffInfo | null => {
    const dayOffInfo = dayOffsWithTime.find(d => d.date.toDateString() === date.toDateString());
    if (dayOffInfo && (dayOffInfo.time_start || dayOffInfo.time_end)) {
      return dayOffInfo;
    }
    return null;
  };

  // Get partial day off info for display
  const getPartialDayOffInfo = (date: Date): string | null => {
    const partial = hasPartialDayOff(date);
    if (!partial) return null;
    
    if (partial.time_start && partial.time_end) {
      return `Closed ${formatTime12Hour(partial.time_start)} - ${formatTime12Hour(partial.time_end)}`;
    } else if (partial.time_start) {
      return `Closes at ${formatTime12Hour(partial.time_start)}`;
    } else if (partial.time_end) {
      return `Opens at ${formatTime12Hour(partial.time_end)}`;
    }
    return null;
  };

  // Get the day name from a date (e.g., 'monday', 'tuesday')
  const getDayName = (date: Date): string => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[date.getDay()];
  };

  // Check if a date has break time scheduled
  const hasBreakTime = (date: Date): boolean => {
    if (breakTimes.length === 0) return false;
    const dayName = getDayName(date);
    return breakTimes.some(bt => bt.days.includes(dayName));
  };

  // Get break time info for a date
  const getBreakTimeInfo = (date: Date): string | null => {
    const dayName = getDayName(date);
    const breakTime = breakTimes.find(bt => bt.days.includes(dayName));
    if (!breakTime) return null;
    return `Break: ${formatTime12Hour(breakTime.start_time)} - ${formatTime12Hour(breakTime.end_time)}`;
  };

  // Format time to 12-hour format
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    // Parse ISO date string (YYYY-MM-DD) in local timezone to avoid UTC offset issues
    const [year, month, day] = selectedDate.split('-').map(Number);
    const selected = new Date(year, month - 1, day);
    return selected.toDateString() === date.toDateString();
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const handleDateClick = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    if (isDateAvailable(date)) {
      // Format date as YYYY-MM-DD in local timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      const isoDate = `${year}-${month}-${dayStr}`;
      onChange(isoDate);
    }
  };

  const renderCalendar = () => {
    const days = [];
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstDayOfMonth(currentMonth);

    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="aspect-square"></div>
      );
    }

    // Add cells for each day of the month
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const available = isDateAvailable(date);
      const selected = isDateSelected(date);
      const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));
      const isFullOff = isFullDayOff(date);
      const partialOff = hasPartialDayOff(date);
      const partialInfo = getPartialDayOffInfo(date);
      const hasBreak = hasBreakTime(date);
      const breakInfo = getBreakTimeInfo(date);

      // Full day off takes precedence - make it unavailable
      // Partial day off still allows selecting the date
      const isDisabled = !available || isPast || isFullOff;

      // Build tooltip
      let tooltip: string | undefined;
      if (isFullOff) {
        tooltip = 'Day Off - Unavailable';
      } else if (partialOff) {
        tooltip = partialInfo || 'Partial Day Off';
      } else if (hasBreak) {
        tooltip = breakInfo || undefined;
      }

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => !isFullOff && handleDateClick(day)}
          disabled={isDisabled}
          title={tooltip}
          className={`aspect-square w-full min-h-[44px] rounded-lg text-xs md:text-sm font-medium transition-all flex flex-col items-center justify-center relative ${
            isFullOff
              ? 'bg-red-50 text-red-400 cursor-not-allowed border border-red-200'
              : partialOff
              ? selected
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-300 hover:scale-105'
              : selected
              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
              : available && !isPast
              ? hasBreak
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 hover:scale-105'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 hover:scale-105'
              : isPast
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-400 cursor-not-allowed'
          }`}
        >
          <span>{day}</span>
          {partialOff && !isFullOff && !selected && (
            <AlertCircle className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-orange-500" />
          )}
          {hasBreak && !isFullOff && !partialOff && !selected && (
            <Clock className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-amber-500" />
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2 md:p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        <button
          type="button"
          onClick={previousMonth}
          className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 md:gap-1.5 mb-1 md:mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs md:text-sm font-medium text-gray-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {renderCalendar()}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-200 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
          <span className="text-gray-600">Available</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-blue-600 rounded"></div>
          <span className="text-gray-600">Selected</span>
        </div>
        {breakTimes.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-amber-50 border border-amber-300 rounded relative">
              <Clock className="w-2 h-2 absolute bottom-0 right-0 text-amber-500" />
            </div>
            <span className="text-gray-600">Has Break</span>
          </div>
        )}
        {dayOffsWithTime.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-orange-50 border border-orange-300 rounded relative">
              <AlertCircle className="w-2 h-2 absolute bottom-0 right-0 text-orange-500" />
            </div>
            <span className="text-gray-600">Partial Closure</span>
          </div>
        )}
        {(dayOffs.length > 0 || dayOffsWithTime.length > 0) && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span className="text-gray-600">Closed</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 bg-gray-100 text-gray-400 rounded flex items-center justify-center text-[10px]">
            X
          </div>
          <span className="text-gray-600">Unavailable</span>
        </div>
      </div>
    </div>
  );
};

export default DatePicker;
