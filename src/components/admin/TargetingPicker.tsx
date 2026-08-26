import { useEffect, useMemo, useState } from 'react';
import { Search, X, MapPin, Package as PackageIcon, Ticket, CalendarDays, Check } from 'lucide-react';
import targetingOptionsService, {
  type TargetingOption,
  type TargetingOptions,
} from '../../services/TargetingOptionsService';

export interface TargetingValue {
  location_ids: number[] | null;
  package_ids: number[] | null;
  attraction_ids: number[] | null;
  event_ids: number[] | null;
}

type ItemAxis = 'package_ids' | 'attraction_ids' | 'event_ids';

const GROUPS: {
  axis: ItemAxis;
  key: keyof Pick<TargetingOptions, 'packages' | 'attractions' | 'events'>;
  label: string;
  one: string;
  icon: typeof PackageIcon;
}[] = [
  { axis: 'package_ids', key: 'packages', label: 'packages', one: 'package', icon: PackageIcon },
  { axis: 'attraction_ids', key: 'attractions', label: 'attractions', one: 'attraction', icon: Ticket },
  { axis: 'event_ids', key: 'events', label: 'events', one: 'event', icon: CalendarDays },
];

const has = (ids: number[] | null | undefined, id: number) => (ids ?? []).includes(id);

/**
 * Picks what something applies to.
 *
 * One venue control, not two: the venues ticked here both scope the question and narrow
 * the item lists below, so the same ten venue names never appear twice meaning different
 * things. An empty list is stated as "all", never as "everything" — the distinction that
 * matters is that "all" keeps covering items added later, while naming items does not.
 */
const TargetingPicker = ({ value, onChange }: { value: TargetingValue; onChange: (next: TargetingValue) => void }) => {
  const [options, setOptions] = useState<TargetingOptions | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    targetingOptionsService.get().then(data => { if (!cancelled) setOptions(data); });
    return () => { cancelled = true; };
  }, []);

  const locationName = useMemo(() => {
    const map: Record<number, string> = {};
    (options?.locations ?? []).forEach(l => { map[l.id] = l.name; });
    return map;
  }, [options]);

  const categories = useMemo(() => {
    const all = new Set<string>();
    GROUPS.forEach(g => (options?.[g.key] ?? []).forEach(item => { if (item.category) all.add(item.category); }));
    return [...all].sort();
  }, [options]);

  const venueScope = value.location_ids ?? [];
  const venueCount = options?.locations.length ?? 0;

  // The ticked venues double as the filter for the item lists below.
  const visible = (items: TargetingOption[]) => {
    const term = search.trim().toLowerCase();
    return items.filter(item => {
      if (venueScope.length && !venueScope.includes(item.location_id)) return false;
      if (categoryFilter.length && !categoryFilter.includes(item.category ?? '')) return false;
      if (term && !`${item.name} ${locationName[item.location_id] ?? ''} ${item.category ?? ''}`.toLowerCase().includes(term)) return false;
      return true;
    });
  };

  const setAxis = (axis: keyof TargetingValue, ids: number[]) =>
    onChange({ ...value, [axis]: ids.length ? ids : null });

  const toggle = (axis: keyof TargetingValue, id: number) => {
    const current = value[axis] ?? [];
    setAxis(axis, current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  };

  const count = (axis: keyof TargetingValue) => (value[axis] ?? []).length;
  const namedAnyItem = GROUPS.some(g => count(g.axis) > 0);

  const summary = useMemo(() => {
    if (!options) return '';

    const items = namedAnyItem
      ? GROUPS.filter(g => count(g.axis) > 0)
          .map(g => `${count(g.axis)} of ${options[g.key].length} ${count(g.axis) === 1 ? g.one : g.label}`)
          .join(' and ')
      : 'every package, attraction and event';

    const venues = venueScope.length
      ? `${venueScope.length} of ${venueCount} venues`
      : `all ${venueCount} venues`;

    return `${items}, at ${venues}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  const chipClass = (on: boolean) =>
    `px-2.5 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
      on ? 'bg-blue-800 text-white border-blue-800' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
    }`;

  if (!options) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-900">
        Shown on <span className="font-semibold">{summary}</span>.
        <span className="block text-blue-700 mt-0.5">
          A list left on “all” keeps covering items you add later. Naming items covers only those.
        </span>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search packages, attractions, events…"
          className="w-full rounded-lg border border-gray-300 pl-9 pr-8 py-2 text-sm"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div className="relative">
          <div className="flex sm:flex-wrap gap-1.5 items-center overflow-x-auto sm:overflow-visible -mx-1 px-1 pb-1 sm:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mr-1 shrink-0">Category</span>
            {categories.map(c => (
              <button key={c} type="button" onClick={() => setCategoryFilter(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])} className={chipClass(categoryFilter.includes(c))}>
                {c}
              </button>
            ))}
            {categoryFilter.length > 0 && (
              <button type="button" onClick={() => setCategoryFilter([])} className="text-xs text-gray-500 hover:text-gray-700 underline ml-1 shrink-0">
                show all categories
              </button>
            )}
          </div>
          <div className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" />
        </div>
      )}

      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 gap-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 min-w-0">
            <MapPin size={15} className="text-gray-400 shrink-0" /> Venues
            <span className="text-xs font-normal text-gray-500 truncate">
              {venueScope.length ? `${venueScope.length} of ${venueCount} chosen` : `all ${venueCount} venues`}
            </span>
          </span>
          {venueScope.length > 0 && (
            <button type="button" onClick={() => setAxis('location_ids', [])} className="text-xs font-semibold text-blue-800 hover:underline shrink-0">
              Apply to all {venueCount} venues
            </button>
          )}
        </div>
        <div className="max-h-40 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
          {options.locations.map(l => (
            <label key={l.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer ${has(value.location_ids, l.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <input type="checkbox" checked={has(value.location_ids, l.id)} onChange={() => toggle('location_ids', l.id)} className="w-4 h-4 rounded border-gray-300 text-blue-800" />
              <span className="text-sm text-gray-800 truncate">{l.name}</span>
            </label>
          ))}
        </div>
        {venueScope.length > 0 && (
          <p className="px-3 py-2 text-[11px] text-gray-500">
            The lists below now show only what {venueScope.length === 1 ? 'this venue sells' : 'these venues sell'}.
          </p>
        )}
      </div>

      {GROUPS.map(group => {
        const items = visible(options[group.key]);
        const chosen = count(group.axis);
        const total = options[group.key].length;
        const Icon = group.icon;
        const allShownChosen = items.length > 0 && items.every(i => has(value[group.axis], i.id));

        return (
          <div key={group.axis} className="rounded-lg border border-gray-200 divide-y divide-gray-100">
            <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800 min-w-0">
                <Icon size={15} className="text-gray-400 shrink-0" />
                <span className="capitalize">{group.label}</span>
                <span className="text-xs font-normal text-gray-500 truncate">
                  {chosen
                    ? `${chosen} of ${total} chosen`
                    : namedAnyItem
                      ? `not shown on any ${group.one}`
                      : items.length === total
                        ? `all ${total} ${group.label}`
                        : `all ${total} ${group.label} · ${items.length} shown here`}
                </span>
              </span>
              <div className="flex gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const shown = items.map(i => i.id);
                    const current = value[group.axis] ?? [];
                    setAxis(group.axis, allShownChosen ? current.filter(id => !shown.includes(id)) : [...new Set([...current, ...shown])]);
                  }}
                  disabled={items.length === 0}
                  className="text-xs font-semibold text-blue-800 hover:underline disabled:text-gray-300 disabled:no-underline"
                >
                  {allShownChosen ? `Remove these ${items.length}` : `Choose these ${items.length}`}
                </button>
                {chosen > 0 && (
                  <>
                    <span className="text-gray-300">·</span>
                    <button type="button" onClick={() => setAxis(group.axis, [])} className="text-xs font-semibold text-gray-500 hover:underline">
                      Apply to all {group.label}
                    </button>
                  </>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-500">
                {total === 0
                  ? `No ${group.label} exist yet.`
                  : `No ${group.label} match this search, category or venue.`}
              </p>
            ) : (
              <div className="max-h-56 overflow-y-auto p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                {items.map(item => {
                  const on = has(value[group.axis], item.id);
                  return (
                    <label key={item.id} className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer ${on ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(group.axis, item.id)} className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-800 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm text-gray-800 truncate">{item.name}</span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          {locationName[item.location_id] ?? `Venue ${item.location_id}`}
                          {item.category ? ` · ${item.category}` : ''}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {namedAnyItem && (
        <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <Check size={14} className="text-green-600 mt-0.5 shrink-0" />
          <div className="flex flex-wrap gap-1.5">
            {GROUPS.flatMap(g =>
              (value[g.axis] ?? []).map(id => {
                const item = options[g.key].find(i => i.id === id);
                return (
                  <button
                    key={`${g.axis}-${id}`}
                    type="button"
                    onClick={() => toggle(g.axis, id)}
                    title="Remove"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white border border-gray-300 text-xs text-gray-700 hover:border-red-300 hover:text-red-600"
                  >
                    {item?.name ?? `#${id}`}
                    <X size={11} />
                  </button>
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetingPicker;
