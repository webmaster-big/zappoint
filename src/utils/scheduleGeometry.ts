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

export interface Timeline {
  start: number;
  end: number;
  interval: number;
  total: number;
  pxPerMinute: number;
  slots: number[];
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

  return { start, end, interval, total: end - start, pxPerMinute: slotHeight / interval, slots };
}

export function blockGeometry(range: TimeRange, timeline: Timeline, minHeight = 0, inset = 0): BlockGeometry {
  const startMinutes = finiteOrNull(range.startMinutes);
  const endMinutes = finiteOrNull(range.endMinutes);

  if (startMinutes === null || endMinutes === null) {
    return { top: 0, height: Math.max(minHeight, 0) };
  }

  const top = (startMinutes - timeline.start) * timeline.pxPerMinute;
  const exact = (endMinutes - startMinutes) * timeline.pxPerMinute;

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
    top: (from - timeline.start) * timeline.pxPerMinute,
    height: (to - from) * timeline.pxPerMinute,
  };
}
