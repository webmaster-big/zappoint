import { formatTimeRange } from '../../../utils/timeFormat';
import { generateSpaceDrivenTimeSlots, generateTimeSlots, DEFAULT_SLOT_CLEANUP_MINUTES } from '../../../utils/timeSlots';

const MINUTES_PER_DAY = 24 * 60;

interface StartTimeArgs {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  interval: number;
  spaceIntervals: number[];
  cleanupMinutes?: number;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The spaces drive the start times whenever at least one of them has an interval set. */
export const spacesDriveStartTimes = (spaceIntervals: number[]) =>
  spaceIntervals.some(minutes => Number.isFinite(minutes) && minutes > 0);

export const resolveStartTimes = ({
  startTime,
  endTime,
  durationMinutes,
  interval,
  spaceIntervals,
  cleanupMinutes = DEFAULT_SLOT_CLEANUP_MINUTES,
}: StartTimeArgs): string[] => {
  if (spacesDriveStartTimes(spaceIntervals)) {
    const fromSpaces = generateSpaceDrivenTimeSlots(startTime, endTime, durationMinutes, spaceIntervals, cleanupMinutes);
    if (fromSpaces) return fromSpaces;
  }
  return generateTimeSlots(startTime, endTime, interval);
};

/**
 * Sentence fragment describing how often this schedule really starts. Never states a raw
 * interval when the spaces drive the grid, and says so plainly when 0 or 1 start fits.
 */
export const startCadenceLabel = (args: StartTimeArgs): string => {
  const starts = resolveStartTimes(args);

  if (starts.length === 0) return 'no start times fit this window';
  if (starts.length === 1) return 'only one start fits this window';

  const gap = smallestGap(starts);

  return gap === null ? `a start every ${args.interval} min` : `a start every ${gap} min`;
};

const smallestGap = (starts: string[]): number | null => {
  if (starts.length < 2) return null;

  const minutes = starts.map(start => {
    const [h, m] = start.split(':').map(Number);
    return h * 60 + m;
  });

  let smallest = Infinity;
  for (let i = 1; i < minutes.length; i += 1) {
    // a window that crosses midnight wraps the clock, so a negative delta is a real gap
    const delta = minutes[i] - minutes[i - 1];
    const gap = delta > 0 ? delta : delta + MINUTES_PER_DAY;
    if (gap > 0 && gap < smallest) smallest = gap;
  }

  return Number.isFinite(smallest) ? smallest : null;
};

export const ScheduleIntervalNote: React.FC<StartTimeArgs & { onUseDuration: () => void }> = props => {
  const { durationMinutes, interval, spaceIntervals, onUseDuration } = props;

  if (!durationMinutes || !interval) return null;

  if (spacesDriveStartTimes(spaceIntervals)) {
    const stagger = Math.min(...spaceIntervals.filter(m => m > 0));
    const starts = resolveStartTimes(props);
    const gap = smallestGap(starts);

    const oneSpace = spaceIntervals.length === 1;

    const cadence =
      starts.length === 0
        ? ' No start time fits inside this window.'
        : starts.length === 1
          ? ' Only one start fits inside this window.'
          : oneSpace
            ? ` This package runs ${durationMinutes} min, so with a ${stagger} min gap a start opens every ${gap} min.`
            : gap !== null && gap !== stagger
              ? ` A start every ${gap} min.`
              : ` A start every ${stagger} min.`;

    return (
      <p className="mt-1.5 text-xs text-gray-500">
        Not used &mdash; your {plural(spaceIntervals.length, 'space')} set the start times.
        {cadence} Edit the interval on the space instead.
      </p>
    );
  }

  if (interval < durationMinutes) {
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

  return <p className="mt-1.5 text-xs text-gray-500">A new start time every {interval} min.</p>;
};

export const ScheduleStartTimesPreview: React.FC<StartTimeArgs> = props => {
  const { durationMinutes, spaceIntervals } = props;
  const starts = resolveStartTimes(props);
  const drivenBySpaces = spacesDriveStartTimes(spaceIntervals) && starts.length > 0;

  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <p className="text-xs font-medium text-gray-600 mb-2">
        Start times customers will see:
        {drivenBySpaces && (
          <span className="ml-1 font-normal text-gray-500">from your {plural(spaceIntervals.length, 'space')}</span>
        )}
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
