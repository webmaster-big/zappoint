import { useEffect, useMemo, useState } from 'react';
import { MapPin, Package as PackageIcon, Ticket, CalendarDays } from 'lucide-react';
import { locationService } from '../../services/LocationService';
import { packageCacheService } from '../../services/PackageCacheService';
import { attractionCacheService } from '../../services/AttractionCacheService';
import { eventCacheService } from '../../services/EventCacheService';
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

  const allLocationIds = useMemo(() => locations.map((l) => l.id), [locations]);

  useEffect(() => {
    if (scopeLocations.length > 0) return;
    locationService
      .getLocations({ per_page: 100 })
      .then((res) => setFallbackLocations((res.data || []).map((l) => ({ id: l.id, name: l.name }))))
      .catch(() => setFallbackLocations([]));
  }, [scopeLocations.length]);

  // Lazy-load packages only when the Packages axis is set to "Specific".
  useEffect(() => {
    if (!modes.package || allPackages.length > 0 || allLocationIds.length === 0) return;
    let cancelled = false;
    setLoading((s) => ({ ...s, package: true }));
    Promise.all(
      allLocationIds.map((id) =>
        packageCacheService.getPackages({ location_id: id, is_active: true }).catch(() => [])
      )
    ).then((groups) => {
      if (cancelled) return;
      setAllPackages(dedupe(groups.flat().map((p) => ({ id: p.id, name: p.name, location_id: p.location_id }))));
      setLoading((s) => ({ ...s, package: false }));
    });
    return () => {
      cancelled = true;
    };
  }, [modes.package, allLocationIds, allPackages.length]);

  useEffect(() => {
    if (!modes.attraction || allAttractions.length > 0 || allLocationIds.length === 0) return;
    let cancelled = false;
    setLoading((s) => ({ ...s, attraction: true }));
    Promise.all(
      allLocationIds.map((id) =>
        attractionCacheService.getAttractions({ location_id: id }).catch(() => [])
      )
    ).then((groups) => {
      if (cancelled) return;
      setAllAttractions(dedupe(groups.flat().map((a) => ({ id: a.id, name: a.name, location_id: a.location_id }))));
      setLoading((s) => ({ ...s, attraction: false }));
    });
    return () => {
      cancelled = true;
    };
  }, [modes.attraction, allLocationIds, allAttractions.length]);

  useEffect(() => {
    if (!modes.event || allEvents.length > 0) return;
    let cancelled = false;
    setLoading((s) => ({ ...s, event: true }));
    eventCacheService
      .getEvents()
      .then((events) => {
        if (cancelled) return;
        setAllEvents(dedupe(events.map((e) => ({ id: e.id, name: e.name, location_id: e.location_id }))));
        setLoading((s) => ({ ...s, event: false }));
      })
      .catch(() => {
        if (!cancelled) setLoading((s) => ({ ...s, event: false }));
      });
    return () => {
      cancelled = true;
    };
  }, [modes.event, allEvents.length]);

  const effectiveLocationIds = useMemo(() => {
    if (value.location_ids && value.location_ids.length > 0) {
      return value.location_ids;
    }
    return allLocationIds;
  }, [value.location_ids, allLocationIds]);

  const inScope = useMemo(() => {
    const set = new Set(effectiveLocationIds);
    return (o: Option) => o.location_id === undefined || set.has(o.location_id);
  }, [effectiveLocationIds]);

  const packages = useMemo(() => allPackages.filter(inScope), [allPackages, inScope]);
  const attractions = useMemo(() => allAttractions.filter(inScope), [allAttractions, inScope]);
  const events = useMemo(() => allEvents.filter(inScope), [allEvents, inScope]);

  const setSpecific = (key: keyof typeof modes) => {
    setModes((m) => ({ ...m, [key]: true }));
    // keep any existing selection; value stays as-is until items are checked
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
    <div className="space-y-5">
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
        emptyLabel="No packages for the selected locations."
        specific={modes.package}
        loading={loading.package}
        options={packages}
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
        emptyLabel="No attractions for the selected locations."
        specific={modes.attraction}
        loading={loading.attraction}
        options={attractions}
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
        emptyLabel="No events for the selected locations."
        specific={modes.event}
        loading={loading.event}
        options={events}
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
        loading ? (
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
