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

export default function TargetingSelector({ value, onChange }: Props) {
  const { locations: scopeLocations } = useLocationScope();
  const [fallbackLocations, setFallbackLocations] = useState<Option[]>([]);
  const [packages, setPackages] = useState<Option[]>([]);
  const [attractions, setAttractions] = useState<Option[]>([]);
  const [events, setEvents] = useState<Option[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const locations: Option[] = useMemo(() => {
    if (scopeLocations.length > 0) {
      return scopeLocations.map((l) => ({ id: l.id, name: l.name }));
    }
    return fallbackLocations;
  }, [scopeLocations, fallbackLocations]);

  useEffect(() => {
    if (scopeLocations.length > 0) return;
    locationService
      .getLocations({ per_page: 100 })
      .then((res) => setFallbackLocations((res.data || []).map((l) => ({ id: l.id, name: l.name }))))
      .catch(() => setFallbackLocations([]));
  }, [scopeLocations.length]);

  const effectiveLocationIds = useMemo(() => {
    if (value.location_ids && value.location_ids.length > 0) {
      return value.location_ids;
    }
    return locations.map((l) => l.id);
  }, [value.location_ids, locations]);

  useEffect(() => {
    if (effectiveLocationIds.length === 0) {
      setPackages([]);
      setAttractions([]);
      setEvents([]);
      return;
    }

    let cancelled = false;
    setLoadingItems(true);

    const loadPackages = Promise.all(
      effectiveLocationIds.map((locationId) =>
        packageService.getPackagesByLocation(locationId).then((res) => res.data || []).catch(() => [])
      )
    ).then((groups) => dedupe(groups.flat().map((p) => ({ id: p.id, name: p.name, location_id: p.location_id }))));

    const loadAttractions = attractionService
      .getAttractions({ per_page: 200 })
      .then((res) => (res.data?.attractions || []).map((a) => ({ id: a.id, name: a.name, location_id: a.location_id })))
      .catch(() => [] as Option[]);

    const loadEvents = eventService
      .getEvents({ per_page: 200 })
      .then((res) => (res.data || []).map((e) => ({ id: e.id, name: e.name, location_id: e.location_id })))
      .catch(() => [] as Option[]);

    Promise.all([loadPackages, loadAttractions, loadEvents]).then(([pkgs, attrs, evts]) => {
      if (cancelled) return;
      const inScope = (o: Option) => o.location_id === undefined || effectiveLocationIds.includes(o.location_id);
      setPackages(pkgs.filter(inScope));
      setAttractions(dedupe(attrs).filter(inScope));
      setEvents(dedupe(evts).filter(inScope));
      setLoadingItems(false);
    });

    return () => {
      cancelled = true;
    };
  }, [effectiveLocationIds.join(',')]);

  const setAxis = (axis: Axis, ids: number[] | null) => {
    const next: TargetingValue = { ...value, [axis]: ids && ids.length > 0 ? ids : null };
    if (axis === 'location_ids') {
      next.package_ids = null;
      next.attraction_ids = null;
      next.event_ids = null;
    }
    onChange(next);
  };

  const toggleId = (axis: Axis, id: number) => {
    const current = value[axis] || [];
    const nextIds = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setAxis(axis, nextIds);
  };

  return (
    <div className="space-y-5">
      <AxisSection
        icon={<MapPin className="w-4 h-4" />}
        title="Locations"
        allLabel="All locations"
        emptyLabel="No locations available."
        options={locations}
        selected={value.location_ids}
        onModeAll={() => setAxis('location_ids', null)}
        onToggle={(id) => toggleId('location_ids', id)}
      />

      <AxisSection
        icon={<PackageIcon className="w-4 h-4" />}
        title="Packages"
        allLabel="All packages"
        emptyLabel="No packages available for the selected locations."
        options={packages}
        selected={value.package_ids}
        loading={loadingItems}
        onModeAll={() => setAxis('package_ids', null)}
        onToggle={(id) => toggleId('package_ids', id)}
      />

      <AxisSection
        icon={<Ticket className="w-4 h-4" />}
        title="Attractions"
        allLabel="All attractions"
        emptyLabel="No attractions available for the selected locations."
        options={attractions}
        selected={value.attraction_ids}
        loading={loadingItems}
        onModeAll={() => setAxis('attraction_ids', null)}
        onToggle={(id) => toggleId('attraction_ids', id)}
      />

      <AxisSection
        icon={<CalendarDays className="w-4 h-4" />}
        title="Events"
        allLabel="All events"
        emptyLabel="No events available for the selected locations."
        options={events}
        selected={value.event_ids}
        loading={loadingItems}
        onModeAll={() => setAxis('event_ids', null)}
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
  options: Option[];
  selected: number[] | null;
  loading?: boolean;
  onModeAll: () => void;
  onToggle: (id: number) => void;
}

function AxisSection({ icon, title, allLabel, emptyLabel, options, selected, loading, onModeAll, onToggle }: AxisSectionProps) {
  const isSpecific = Array.isArray(selected) && selected.length > 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-500">{icon}</span>
        <span className="font-medium text-gray-800 text-sm">{title}</span>
      </div>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={onModeAll}
          className={`px-3 py-1.5 rounded-md text-xs font-medium border ${!isSpecific ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
        >
          {allLabel}
        </button>
        <span className={`px-3 py-1.5 rounded-md text-xs font-medium border ${isSpecific ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-400 border-gray-200'}`}>
          Specific
        </span>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {options.map((opt) => {
            const checked = Array.isArray(selected) && selected.includes(opt.id);
            return (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-700 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => onToggle(opt.id)} className="rounded border-gray-300" />
                <span className="truncate">{opt.name}</span>
              </label>
            );
          })}
        </div>
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
