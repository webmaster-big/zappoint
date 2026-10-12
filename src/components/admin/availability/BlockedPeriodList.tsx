import React from 'react';
import { CalendarOff, Clock, MapPin, User, Users } from 'lucide-react';

export interface BlockedPeriodSummary {
  id: number;
  date?: string | null;
  occurrence_date?: string;
  group_name: string | null;
  reason: string | null;
  window_label: string;
  scope_label: string;
  location_name?: string | null;
  location_id?: number | null;
  scope?: string | null;
  set_by?: { name: string } | null;
}

interface BlockedPeriodListProps {
  periods: BlockedPeriodSummary[];
  showLocation?: boolean;
  compact?: boolean;
}

const formatDay = (date?: string | null): string | null => {
  if (!date) return null;
  const [year, month, day] = date.split('T')[0].split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};

const BlockedPeriodList: React.FC<BlockedPeriodListProps> = ({ periods, showLocation = false, compact = false }) => (
  <ul className={compact ? 'space-y-2' : 'space-y-3'}>
    {periods.map(period => {
      const day = formatDay(period.occurrence_date ?? period.date);
      return (
        <li key={`${period.id}-${period.occurrence_date ?? period.date}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="flex items-start gap-2">
            <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {period.group_name || 'Blocked'}
                {period.reason && <span className="font-normal text-gray-700"> — {period.reason}</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-700">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {day ? `${day} · ` : ''}{period.window_label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {period.scope_label}
                </span>
                {showLocation && period.location_name && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {period.location_name}
                  </span>
                )}
                {!compact && (
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Set by {period.set_by?.name ?? 'an earlier version of the system'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </li>
      );
    })}
  </ul>
);

export default BlockedPeriodList;
