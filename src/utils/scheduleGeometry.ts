export const MINUTES_PER_DAY = 24 * 60;

function finite(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function finiteOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface TimeRange {
  startMinutes: number;
  endMinutes: number;
  reason?: string | null;
}

/**
 * A stretch of the day that must be drawn at least this tall, whatever the base scale says.
 *
 * A fifteen-minute booking at the normal scale is a sliver too short to name its guest. Rather than
 * making the whole day taller — which pushes every empty hour down the page for nothing — only the
 * minutes that actually hold that booking are stretched.
 */
export interface StretchSpan {
  startMinutes: number;
  endMinutes: number;
  minHeight: number;
}

/**
 * Minutes to pixels, where the rate can change through the day.
 *
 * Everything on the grid — the time gutter, the hour lines, the now-line, every block in every
 * column — has to read its position from this one object, or a stretched stretch would slide the
 * columns out of step with the clock beside them.
 */
export interface MinuteScale {
  /** The unstretched rate, for anything that just needs a rough pixels-per-minute. */
  base: number;
  /** Total pixels from the first minute to the last. */
  height: number;
  /** Pixels from the start of the timeline to this minute. */
  at(minute: number): number;
  /** The minute sitting this many pixels down. The inverse of at(). */
  minuteAt(offsetPx: number): number;
  /** How tall this span of minutes is drawn. */
  spanHeight(fromMinute: number, toMinute: number): number;
}

export interface Timeline {
  start: number;
  end: number;
  interval: number;
  total: number;
  pxPerMinute: number;
  slots: number[];
  scale: MinuteScale;
  /** Total pixel height of the day, stretching included. */
  height: number;
}

interface ScaleSegment {
  from: number;
  to: number;
  rate: number;
  top: number;
}

export function buildMinuteScale(
  startMinutes: number,
  endMinutes: number,
  pxPerMinute: number,
  stretch: StretchSpan[] = [],
): MinuteScale {
  const base = Math.max(0.01, finite(pxPerMinute, 1));
  const start = finite(startMinutes, 0);
  const end = Math.max(start + 1, finite(endMinutes, start + 1));

  const wanted = stretch
    .map(span => ({
      from: Math.max(start, finite(span.startMinutes, NaN)),
      to: Math.min(end, finite(span.endMinutes, NaN)),
      minHeight: finite(span.minHeight, 0),
    }))
    .filter(span => span.to > span.from && span.minHeight > (span.to - span.from) * base);

  const edges = new Set<number>([start, end]);
  for (const span of wanted) {
    edges.add(span.from);
    edges.add(span.to);
  }

  const points = [...edges].sort((a, b) => a - b);
  const segments: ScaleSegment[] = [];
  let top = 0;

  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (to <= from) continue;

    let rate = base;
    for (const span of wanted) {
      // where two bookings want the same minutes stretched, the hungrier one wins for both
      if (span.from < to && span.to > from) rate = Math.max(rate, span.minHeight / (span.to - span.from));
    }

    segments.push({ from, to, rate, top });
    top += (to - from) * rate;
  }

  if (segments.length === 0) segments.push({ from: start, to: end, rate: base, top: 0 });

  const last = segments[segments.length - 1];
  const height = last.top + (last.to - last.from) * last.rate;

  const segmentAtMinute = (minute: number): ScaleSegment => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].from <= minute) lo = mid;
      else hi = mid - 1;
    }
    return segments[lo];
  };

  const segmentAtPixel = (offset: number): ScaleSegment => {
    let lo = 0;
    let hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segments[mid].top <= offset) lo = mid;
      else hi = mid - 1;
    }
    return segments[lo];
  };

  const at = (minute: number): number => {
    const m = finite(minute, start);
    // outside the drawn day the base rate still applies, so a block that starts early or runs past
    // close is placed sensibly instead of being clamped onto the edge
    if (m <= start) return (m - start) * base;
    if (m >= end) return height + (m - end) * base;

    const segment = segmentAtMinute(m);
    return segment.top + (m - segment.from) * segment.rate;
  };

  const minuteAt = (offsetPx: number): number => {
    const px = finite(offsetPx, 0);
    if (px <= 0) return start + px / base;
    if (px >= height) return end + (px - height) / base;

    const segment = segmentAtPixel(px);
    return segment.from + (px - segment.top) / segment.rate;
  };

  return { base, height, at, minuteAt, spanHeight: (from, to) => at(to) - at(from) };
}

export interface BlockGeometry {
  top: number;
  height: number;
}

export function buildTimeline(
  openMinutes: number,
  closeMinutes: number,
  intervalMinutes: number,
  slotHeight: number,
  ranges: TimeRange[] = [],
  stretch: StretchSpan[] = [],
): Timeline {
  const interval = Math.max(5, Math.round(finite(intervalMinutes, 30)) || 30);

  let start = finite(openMinutes, 10 * 60);
  let end = finite(closeMinutes, 22 * 60);

  for (const range of ranges) {
    const rangeStart = finiteOrNull(range.startMinutes);
    const rangeEnd = finiteOrNull(range.endMinutes);
    if (rangeStart !== null && rangeStart < start) start = rangeStart;
    if (rangeEnd !== null && rangeEnd > end) end = rangeEnd;
  }

  start = Math.max(0, Math.floor(start / interval) * interval);
  end = Math.ceil(end / interval) * interval;
  if (end <= start) end = start + interval;

  const slots: number[] = [];
  for (let minutes = start; minutes < end; minutes += interval) slots.push(minutes);

  const pxPerMinute = slotHeight / interval;
  const scale = buildMinuteScale(start, end, pxPerMinute, stretch);

  return { start, end, interval, total: end - start, pxPerMinute, slots, scale, height: scale.height };
}

export function blockGeometry(range: TimeRange, timeline: Timeline, minHeight = 0, inset = 0): BlockGeometry {
  const startMinutes = finiteOrNull(range.startMinutes);
  const endMinutes = finiteOrNull(range.endMinutes);

  if (startMinutes === null || endMinutes === null) {
    return { top: 0, height: Math.max(minHeight, 0) };
  }

  const top = timeline.scale.at(startMinutes);
  const exact = timeline.scale.at(endMinutes) - top;

  return { top, height: Math.max(minHeight, exact - inset) };
}

export function minuteAtOffset(originMinute: number, offsetPx: number, pxPerMinute: number): number {
  const origin = finite(originMinute, 0);
  const offset = finite(offsetPx, 0);
  const scale = finite(pxPerMinute, 0);

  if (scale <= 0) return origin;

  return origin + offset / scale;
}

export function assignLanes<T extends TimeRange & { lane: number; laneCount: number }>(items: T[]): T[] {
  const ordered = [...items]
    .filter(i => Number.isFinite(i.startMinutes) && Number.isFinite(i.endMinutes))
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);

  let cluster: T[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    const count = Math.max(1, laneEnds.length);
    for (const member of cluster) member.laneCount = count;
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };

  for (const item of ordered) {
    if (item.startMinutes >= clusterEnd) closeCluster();

    let lane = laneEnds.findIndex(end => end <= item.startMinutes);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.endMinutes);
    } else {
      laneEnds[lane] = item.endMinutes;
    }

    item.lane = lane;
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }

  closeCluster();

  for (const item of items) {
    if (!Number.isFinite(item.startMinutes) || !Number.isFinite(item.endMinutes)) item.laneCount = 1;
  }

  return items;
}

export type FreeState =
  | { kind: 'free'; atMinute: number }
  | { kind: 'booked'; untilClose: true }
  | { kind: 'blocked'; reason: string }
  | { kind: 'closed' }
  | { kind: 'day-over' };

export function freeState(
  openMinutes: number | null,
  closeMinutes: number | null,
  busy: TimeRange[],
  from: number,
  bookable = true,
): FreeState {
  const open = finiteOrNull(openMinutes);
  const close = finiteOrNull(closeMinutes);
  const asOf = finiteOrNull(from);

  if (!bookable || open === null || close === null || asOf === null || close <= open) {
    return { kind: 'closed' };
  }

  if (asOf >= close) {
    return { kind: 'day-over' };
  }

  const floor = Math.max(open, asOf);
  let cursor = floor;

  const usable = busy
    .map(r => ({ startMinutes: finiteOrNull(r.startMinutes), endMinutes: finiteOrNull(r.endMinutes), reason: r.reason ?? null }))
    .filter((r): r is { startMinutes: number; endMinutes: number; reason: string | null } => r.startMinutes !== null && r.endMinutes !== null)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  let lastReason: string | null = null;

  for (const range of usable) {
    if (range.endMinutes <= cursor) continue;
    if (range.startMinutes > cursor) break;
    if (range.endMinutes > cursor) lastReason = range.reason ?? null;
    cursor = Math.max(cursor, range.endMinutes);
  }

  if (cursor < close) return { kind: 'free', atMinute: cursor };

  return lastReason ? { kind: 'blocked', reason: lastReason } : { kind: 'booked', untilClose: true };
}

export function nextFreeMinute(
  openMinutes: number | null,
  closeMinutes: number | null,
  busy: TimeRange[],
  from: number,
): number | null {
  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) return null;

  const floor = Math.max(openMinutes, from);
  if (floor >= closeMinutes) return null;

  let cursor = floor;
  for (const range of [...busy].sort((a, b) => a.startMinutes - b.startMinutes)) {
    if (range.endMinutes <= cursor) continue;
    if (range.startMinutes > cursor) break;
    cursor = Math.max(cursor, range.endMinutes);
  }

  return cursor < closeMinutes ? cursor : null;
}

export function availableBand(
  openMinutes: number | null,
  closeMinutes: number | null,
  timeline: Timeline,
): BlockGeometry | null {
  const open = finiteOrNull(openMinutes);
  const close = finiteOrNull(closeMinutes);
  if (open === null || close === null) return null;

  const from = Math.max(open, timeline.start);
  const to = Math.min(close, timeline.end);
  if (to <= from) return null;

  return {
    top: timeline.scale.at(from),
    height: timeline.scale.spanHeight(from, to),
  };
}

export function freeUntilMinute(
  openMinutes: number | null,
  closeMinutes: number | null,
  busy: TimeRange[],
  from: number,
): number | null {
  const open = finiteOrNull(openMinutes);
  const close = finiteOrNull(closeMinutes);
  const start = finiteOrNull(from);

  if (open === null || close === null || start === null || close <= open) return null;

  let end = close;

  for (const range of busy) {
    const rangeStart = finiteOrNull(range.startMinutes);
    const rangeEnd = finiteOrNull(range.endMinutes);
    if (rangeStart === null || rangeEnd === null || rangeEnd <= rangeStart) continue;
    if (rangeEnd <= start) continue;
    if (rangeStart <= start) return start;
    if (rangeStart < end) end = rangeStart;
  }

  return end;
}
