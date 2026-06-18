/** Animated skeleton placeholders for loading states. */

interface SkeletonProps {
  className?: string;
}

/** A single animated shimmer block. */
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
    />
  );
}

/** Skeleton for a table row (matches membership list columns). */
export function SkeletonTableRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr className="border-b border-gray-100">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            {i === 0 && <Skeleton className="h-2.5 w-1/2" />}
          </div>
        </td>
      ))}
    </tr>
  );
}

/** Skeleton for a stat/metric card. */
export function SkeletonStatCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 min-h-[120px]">
      <div className="flex items-center gap-2">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-7 w-14 mt-1" />
    </div>
  );
}

/** Skeleton for a plan card. */
export function SkeletonPlanCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-7 w-20 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}

/** Skeleton for the membership detail page hero card. */
export function SkeletonDetailCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-28" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Thin syncing indicator bar at top of a container. */
export function SyncingBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="h-0.5 w-full rounded-t-xl overflow-hidden bg-blue-100">
      <div className="h-full w-1/3 bg-blue-400 animate-pulse rounded-full" />
    </div>
  );
}
