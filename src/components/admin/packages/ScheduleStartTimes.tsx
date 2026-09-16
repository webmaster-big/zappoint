import { formatTimeRange } from '../../../utils/timeFormat';
import { generateTimeSlots } from '../../../utils/timeSlots';

const MINUTES_PER_DAY = 24 * 60;

interface StartTimeArgs {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  interval: number;
  spaceIntervals: number[];
  cleanupMinutes?: number;
}

/**
 * The schedule interval decides which start times are offered. A space's booking interval is
 * its turnaround AFTER a booking — it removes slots once one is taken, it never thins this list.
 */
export const resolveStartTimes = ({ startTime, endTime, interval, durationMinutes }: StartTimeArgs): string[] =>
  generateTimeSlots(startTime, endTime, interval, durationMinutes);

export const startCadenceLabel = (args: StartTimeArgs): string => {
  const starts = resolveStartTimes(args);

  if (starts.length === 0) return 'no start times fit this window';
  if (starts.length === 1) return 'only one start fits this window';

  return `a start every ${args.interval} min`;
};

export const ScheduleIntervalNote: React.FC<StartTimeArgs & { onUseDuration: () => void }> = props => {
  const { durationMinutes, interval, spaceIntervals, onUseDuration } = props;

  if (!durationMinutes || !interval) return null;

  const spaces = spaceIntervals.filter(m => Number.isFinite(m) && m > 0);
  const turnaround = spaces.length > 0 ? Math.min(...spaces) : null;

  const spaceNote = turnaround !== null && (
    <>
      {' '}Once a booking is taken, that space reopens {turnaround} min after it ends
      {spaceIntervals.length > 1
        ? `, and spaces sharing an area group also hold that ${turnaround} min apart from each other.`
        : '.'}
    </>
  );

  if (interval < durationMinutes && spaceIntervals.length === 0) {
    return (
      <div className="mt-1.5 flex items-start gap-1.5">
        <p className="text-xs text-amber-700">
          Start times are {interval} min apart but this lasts {durationMinutes} min, so they overlap. No space is
          attached, so nothing stops two bookings running at once.
        </p>
        <button
          type="button"
          onClick={onUseDuration}
          className="text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap"
        >
          Use {durationMinutes} min
        </button>
      </div>
    );
  }

  return (
    <p className="mt-1.5 text-xs text-gray-500">
      A start every {interval} min.{spaceNote}
    </p>
  );
};

export const ScheduleStartTimesPreview: React.FC<StartTimeArgs> = props => {
  const { durationMinutes } = props;
  const starts = resolveStartTimes(props);

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-600 mb-2">
        Start times customers will see:
      </p>
      <div className="flex flex-wrap gap-1">
        {starts.length === 0 ? (
          <span className="text-xs text-gray-500">No start times fit inside this window.</span>
        ) : (
          starts.map(start => {
            const [h, m] = start.split(':').map(Number);
            const endTotal = (h * 60 + m + durationMinutes) % MINUTES_PER_DAY;
            const end = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;
            return (
              <span key={start} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                {formatTimeRange(start, end)}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};
