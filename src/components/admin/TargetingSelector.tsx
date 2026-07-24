import { useEffect, useMemo, useState } from 'react';
import { MapPin, Package as PackageIcon, Ticket, CalendarDays } from 'lucide-react';
import { locationService } from '../../services/LocationService';
import { packageService } from '../../services/PackageService';
import { attractionService } from '../../services/AttractionService';
import { eventService } from '../../services/EventService';
import { useLocationScope } from '../../contexts/LocationContext';

export interface TargetingValue {
  location_ids: number[] | null;
  package_ids: number[] | null;
  attraction_ids: number[] | null;
  event_ids: number[] | null;
}

interface Option {
  id: number;
  name: string;
  location_id?: number;
}

interface Props {
  value: TargetingValue;
  onChange: (value: TargetingValue) => void;
}

type Axis = 'location_ids' | 'package_ids' | 'attraction_ids' | 'event_ids';
type ItemKey = 'package' | 'attraction' | 'event';

// Per-location, session-level cache (keyed by location) with stale-while-revalidate.
// Cached locations render instantly; stale/missing entries revalidate in the background.
const ITEM_TTL = 5 * 60 * 1000;
interface CacheEntry {
  data: Option[];
  ts: number;
}
const itemStores: Record<ItemKey, Map<number, CacheEntry>> = {
  package: new Map(),
  attraction: new Map(),
  event: new Map(),
};

const toOption = (x: { id: number; name: string; location_id?: number }): Option => ({
  id: x.id,
  name: x.name,
  location_id: x.location_id,
});

const itemFetchers: Record<ItemKey, (locationId: number) => Promise<Option[]>> = {
  package: (id) =>
    packageService.getPackagesByLocation(id).then((r) => (r.data || []).map(toOption)).catch(() => []),
  attraction: (id) =>
    attractionService.getAttractions({ location_id: id, per_page: 200 }).then((r) => (r.data?.attractions || []).map(toOption)).catch(() => []),
  event: (id) =>
    eventService.getEventsByLocation(id).then((r) => (r.data || []).map(toOption)).catch(() => []),
};

function peekItems(kind: ItemKey, ids: number[]): Option[] {
  const store = itemStores[kind];
  const out: Option[] = [];
  for (const id of ids) {
    const entry = store.get(id);
    if (entry) out.push(...entry.data);
  }
  return dedupe(out);
}

async function ensureItems(kind: ItemKey, ids: number[]): Promise<Option[]> {
  const store = itemStores[kind];
  const now = Date.now();
  await Promise.all(
    ids.map(async (id) => {
      const entry = store.get(id);
      if (entry && now - entry.ts < ITEM_TTL) return; // fresh
      const data = await itemFetchers[kind](id);
      store.set(id, { data, ts: Date.now() });
    })
  );
  return peekItems(kind, ids);
}

export default function TargetingSelector({ value, onChange }: Props) {
  const { locations: scopeLocations } = useLocationScope();
  const [fallbackLocations, setFallbackLocations] = useState<Option[]>([]);

  const [allPackages, setAllPackages] = useState<Option[]>([]);
  const [allAttractions, setAllAttractions] = useState<Option[]>([]);
  const [allEvents, setAllEvents] = useState<Option[]>([]);
  const [loading, setLoading] = useState({ package: false, attraction: false, event: false });

  const [modes, setModes] = useState({
    location: (value.location_ids?.length ?? 0) > 0,
    package: (value.package_ids?.length ?? 0) > 0,
    attraction: (value.attraction_ids?.length ?? 0) > 0,
    event: (value.event_ids?.length ?? 0) > 0,
  });

  const locations: Option[] = useMemo(() => {
    if (scopeLocations.length > 0) {
      return scopeLocations.map((l) => ({ id: l.id, name: l.name }));
    }
    return fallbackLocations;
  }, [scopeLocations, fallbackLocations]);

  const locationNameById = useMemo(
    () => Object.fromEntries(locations.map((l) => [l.id, l.name])) as Record<number, string>,
    [locations]
  );

  useEffect(() => {
    if (scopeLocations.length > 0) return;
    locationService
      .getLocations({ per_page: 100 })
      .then((res) => setFallbackLocations((res.data || []).map((l) => ({ id: l.id, name: l.name }))))
      .catch(() => setFallbackLocations([]));
  }, [scopeLocations.length]);

  // Items are scoped to the selected locations (location-first).
  const scopedLocationIds = useMemo(() => value.location_ids ?? [], [value.location_ids]);
  const scopeKey = scopedLocationIds.join(',');
  const hasLocation = scopedLocationIds.length > 0;

  const loadItems = (
    kind: ItemKey,
    active: boolean,
    setItems: (o: Option[]) => void
  ) => {
    if (!active || !hasLocation) {
      setItems([]);
      return undefined;
    }
    let cancelled = false;
    const cached = peekItems(kind, scopedLocationIds);
    if (cached.length > 0) {
      setItems(cached);
      setLoading((s) => ({ ...s, [kind]: false }));
    } else {
      setLoading((s) => ({ ...s, [kind]: true }));
    }
    ensureItems(kind, scopedLocationIds).then((data) => {
      if (cancelled) return;
      setItems(data);
      setLoading((s) => ({ ...s, [kind]: false }));
    });
    return () => {
      cancelled = true;
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadItems('package', modes.package, setAllPackages), [modes.package, scopeKey, hasLocation]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadItems('attraction', modes.attraction, setAllAttractions), [modes.attraction, scopeKey, hasLocation]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadItems('event', modes.event, setAllEvents), [modes.event, scopeKey, hasLocation]);

  const summary = useMemo(() => {
    const nameOf = (list: Option[], id: number) => list.find((o) => o.id === id)?.name;
    const describe = (ids: number[] | null | undefined, list: Option[], noun: string): string | null => {
      if (!ids || ids.length === 0) return null;
      const names = ids.map((id) => nameOf(list, id)).filter(Boolean) as string[];
      if (names.length === ids.length && ids.length <= 3) return names.join(', ');
      return `${ids.length} ${noun}${ids.length === 1 ? '' : 's'}`;
    };

    const locText =
      value.location_ids && value.location_ids.length > 0
        ? describe(value.location_ids, locations, 'location')
        : 'all locations';

    const hasItemTarget =
      (value.package_ids?.length ?? 0) + (value.attraction_ids?.length ?? 0) + (value.event_ids?.length ?? 0) > 0;

    let itemText: string;
    if (!hasItemTarget) {
      itemText = 'all packages, attractions & events';
    } else {
      const parts: string[] = [];
      const p = describe(value.package_ids, allPackages, 'package');
      const a = describe(value.attraction_ids, allAttractions, 'attraction');
      const e = describe(value.event_ids, allEvents, 'event');
      if (p) parts.push(`packages (${p})`);
      if (a) parts.push(`attractions (${a})`);
      if (e) parts.push(`events (${e})`);
      itemText = `only ${parts.join('; ')}`;
    }

    return `${itemText} · ${locText}`;
  }, [value, locations, allPackages, allAttractions, allEvents]);

  const setSpecific = (key: keyof typeof modes) => {
    setModes((m) => ({ ...m, [key]: true }));
  };

  const setAll = (axis: Axis, key: keyof typeof modes) => {
    const next: TargetingValue = { ...value, [axis]: null };
    if (axis === 'location_ids') {
      next.package_ids = null;
      next.attraction_ids = null;
      next.event_ids = null;
      setModes((m) => ({ ...m, location: false, package: false, attraction: false, event: false }));
    } else {
      setModes((m) => ({ ...m, [key]: false }));
    }
    onChange(next);
  };

  const toggleId = (axis: Axis, id: number) => {
    const current = value[axis] || [];
    const nextIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    onChange({ ...value, [axis]: nextIds.length > 0 ? nextIds : null });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs bg-blue-50 text-blue-900 rounded-md px-3 py-2 border border-blue-100">
        <span className="font-semibold">Applies to:</span> {summary}
      </div>

      <AxisSection
        icon={<MapPin className="w-4 h-4" />}
        title="Locations"
        allLabel="All locations"
        emptyLabel="No locations available."
        specific={modes.location}
        options={locations}
        selected={value.location_ids}
        onSetAll={() => setAll('location_ids', 'location')}
        onSetSpecific={() => setSpecific('location')}
        onToggle={(id) => toggleId('location_ids', id)}
      />

      <AxisSection
        icon={<PackageIcon className="w-4 h-4" />}
        title="Packages"
        allLabel="All packages"
        emptyLabel="No packages at the selected location(s)."
        specific={modes.package}
        loading={loading.package}
        needsLocation={!hasLocation}
        options={allPackages}
        selected={value.package_ids}
        locationNameById={locationNameById}
        onSetAll={() => setAll('package_ids', 'package')}
        onSetSpecific={() => setSpecific('package')}
        onToggle={(id) => toggleId('package_ids', id)}
      />

      <AxisSection
        icon={<Ticket className="w-4 h-4" />}
        title="Attractions"
        allLabel="All attractions"
        emptyLabel="No attractions at the selected location(s)."
        specific={modes.attraction}
        loading={loading.attraction}
        needsLocation={!hasLocation}
        options={allAttractions}
        selected={value.attraction_ids}
        locationNameById={locationNameById}
        onSetAll={() => setAll('attraction_ids', 'attraction')}
        onSetSpecific={() => setSpecific('attraction')}
        onToggle={(id) => toggleId('attraction_ids', id)}
      />

      <AxisSection
        icon={<CalendarDays className="w-4 h-4" />}
        title="Events"
        allLabel="All events"
        emptyLabel="No events at the selected location(s)."
        specific={modes.event}
        loading={loading.event}
        needsLocation={!hasLocation}
        options={allEvents}
        selected={value.event_ids}
        locationNameById={locationNameById}
        onSetAll={() => setAll('event_ids', 'event')}
        onSetSpecific={() => setSpecific('event')}
        onToggle={(id) => toggleId('event_ids', id)}
      />
    </div>
  );
}

interface AxisSectionProps {
  icon: React.ReactNode;
  title: string;
  allLabel: string;
  emptyLabel: string;
  specific: boolean;
  loading?: boolean;
  needsLocation?: boolean;
  options: Option[];
  selected: number[] | null;
  locationNameById?: Record<number, string>;
  onSetAll: () => void;
  onSetSpecific: () => void;
  onToggle: (id: number) => void;
}

function AxisSection({
  icon,
  title,
  allLabel,
  emptyLabel,
  specific,
  loading,
  needsLocation,
  options,
  selected,
  locationNameById,
  onSetAll,
  onSetSpecific,
  onToggle,
}: AxisSectionProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <span className="font-medium text-gray-800 text-sm">{title}</span>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={onSetAll}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${!specific ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
        >
          {allLabel}
        </button>
        <button
          type="button"
          onClick={onSetSpecific}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${specific ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
        >
          Specific
        </button>
      </div>

      {specific && (
        needsLocation ? (
          <p className="text-xs text-amber-600">Select one or more locations above first.</p>
        ) : loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : options.length === 0 ? (
          <p className="text-xs text-gray-400">{emptyLabel}</p>
        ) : (
          <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
            {options.map((opt) => {
              const checked = Array.isArray(selected) && selected.includes(opt.id);
              const locName = locationNameById && opt.location_id !== undefined ? locationNameById[opt.location_id] : undefined;
              return (
                <label key={opt.id} className="flex items-start gap-2 text-sm text-gray-700 px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={checked} onChange={() => onToggle(opt.id)} className="rounded border-gray-300 flex-shrink-0 mt-0.5" />
                  <span className="min-w-0 break-words">
                    {opt.name}
                    {locName && <span className="block text-xs text-gray-400">{locName}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function dedupe(items: Option[]): Option[] {
  const seen = new Set<number>();
  const result: Option[] = [];
  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}
