import React from 'react';
import { CalendarOff } from 'lucide-react';
import type { BlockedPeriodSummary } from './BlockedPeriodList';
import type { BlockBookingKind } from '../../../utils/blockBookingPath';

const KIND_ORDER: BlockBookingKind[] = ['package', 'space', 'attraction', 'event'];

const KIND_LABELS: Record<BlockBookingKind, string> = {
  package: 'Book a package inside this block',
  space: 'Book a blocked space',
  attraction: 'Sell attraction tickets',
  event: 'Sell event tickets',
};

const kindsFor = (periods: BlockedPeriodSummary[]): BlockBookingKind[] => {
  const kinds = new Set<BlockBookingKind>();
  periods.forEach(period => {
    if (period.scope === 'rooms') kinds.add('space');
    else if (period.scope === 'attractions') kinds.add('attraction');
    else if (period.scope === 'events') kinds.add('event');
    else if (period.scope === 'mixed') {
      kinds.add('package');
      kinds.add('space');
    } else kinds.add('package');
  });
  return KIND_ORDER.filter(kind => kinds.has(kind));
};

interface BlockedPeriodBannerProps {
  periods?: BlockedPeriodSummary[] | null;
  className?: string;
  onBook?: (kind: BlockBookingKind, locationId: number | null) => void;
}

const BlockedPeriodBanner: React.FC<BlockedPeriodBannerProps> = ({ periods, className = '', onBook }) => {
  if (!periods || periods.length === 0) return null;

  const locationIds = Array.from(new Set(periods.map(period => period.location_id).filter((id): id is number => typeof id === 'number')));
  const sharedLocationId = locationIds.length === 1 ? locationIds[0] : null;
  const showLocation = locationIds.length > 1;

  return (
    <div className={`border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900 ${className}`} role="note">
      <p className="flex items-center gap-1.5 font-semibold">
        <CalendarOff className="h-3.5 w-3.5 shrink-0" />
        Blocked on this day — guests cannot book these times online
      </p>
      <ul className="mt-1 space-y-0.5">
        {periods.map(period => (
          <li key={`${period.id}-${period.occurrence_date ?? period.date ?? ''}`}>
            {showLocation && period.location_name ? `${period.location_name} · ` : ''}
            <span className="font-semibold">{period.group_name || 'Blocked'}</span>
            {' — '}
            {period.scope_label}: {period.window_label}
            {period.reason ? ` · ${period.reason}` : ''}
            {period.set_by?.name ? ` · set by ${period.set_by.name}` : ''}
          </li>
        ))}
      </ul>
      {onBook && (
        <div className="mt-2 flex flex-wrap gap-2">
          {kindsFor(periods).map(kind => (
            <button
              key={kind}
              type="button"
              onClick={() => onBook(kind, sharedLocationId)}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-100"
            >
              {KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default BlockedPeriodBanner;
