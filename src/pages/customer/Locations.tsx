import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Search, ChevronRight, X, Zap } from 'lucide-react';
import { useStorefrontLocations } from '../../hooks/useStorefrontLocations';
import type { StorefrontLocation } from '../../services/StorefrontLocationService';
import { customerDataCacheService } from '../../services/CustomerDataCacheService';
import type { GroupedAttraction, GroupedPackage, GroupedEvent } from '../../services/CustomerService';
import SiteFooter from '../../components/customer/SiteFooter';
import LocationsMap from '../../components/customer/LocationsMap';
import { splitLocationName } from '../../utils/locationName';

interface LocationTally {
  packages: number;
  attractions: number;
  events: number;
}

const emptyTally = (): LocationTally => ({ packages: 0, attractions: 0, events: 0 });

const LocationChooser = () => {
  const { locations, loaded, failed } = useStorefrontLocations();
  const [query, setQuery] = useState('');
  const [tallies, setTallies] = useState<Record<number, LocationTally>>({});

  const buildTallies = useCallback((
    attractions: GroupedAttraction[],
    packages: GroupedPackage[],
    events: GroupedEvent[],
  ) => {
    const next: Record<number, LocationTally> = {};

    const bump = (locationId: number, key: keyof LocationTally) => {
      if (!next[locationId]) next[locationId] = emptyTally();
      next[locationId][key] += 1;
    };

    packages.forEach((pkg) => pkg.locations.forEach((loc) => bump(loc.location_id, 'packages')));
    attractions.forEach((attr) => attr.locations.forEach((loc) => bump(loc.location_id, 'attractions')));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    events
      .filter((evt) => {
        const endDate = (evt.end_date || evt.start_date || '').substring(0, 10);
        if (!endDate) return false;
        return new Date(`${endDate}T23:59:59`) >= today;
      })
      .forEach((evt) => evt.locations.forEach((loc) => bump(loc.location_id, 'events')));

    setTallies(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const cached = await customerDataCacheService.getCachedAll();
        if (cached && !cancelled) {
          buildTallies(cached.attractions, cached.packages, cached.events);
        }
        const fresh = await customerDataCacheService.fetchAndCache();
        if (!cancelled) {
          buildTallies(fresh.attractions, fresh.packages, fresh.events);
        }
      } catch {
        /* counts are a nicety; the location list stands without them */
      }
    };

    load();
    return () => { cancelled = true; };
  }, [buildTallies]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return locations;
    return locations.filter((location) => {
      const haystack = [
        location.name,
        location.city,
        location.state,
        location.slug,
        location.address,
        location.zip_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [locations, query]);

  const addressLine = (location: StorefrontLocation) =>
    [location.address, location.city, location.state].filter(Boolean).join(', ');


  const showSkeletons = !loaded && locations.length === 0;
  const loadFailed = loaded && failed && locations.length === 0;
  const noLocationsPublished = loaded && !failed && locations.length === 0;

  return (
    <>
      <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white overflow-hidden">
        <div className="hidden lg:flex flex-col absolute top-4 bottom-8 right-0 w-[52%] xl:w-[50%]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200/80 mb-2">
            Click a pin to open that location
          </p>
          <LocationsMap locations={visible} className="flex-1 min-h-0" />
        </div>

        {/* The centred wrapper is wider than the text inside it and overlaps the map, so it must
            not intercept clicks. Its interactive children opt back in below. */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 pointer-events-none">
          <div className="max-w-2xl animate-fade-in-up pointer-events-auto">
            <div className="inline-flex items-center space-x-2 bg-white/15 backdrop-blur-md px-4 py-2 md:px-5 md:py-2.5 rounded-full mb-5 md:mb-7 border border-white/20">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-yellow-300" />
              <span className="text-xs md:text-sm font-semibold tracking-wide">
                {locations.length > 0 ? `${locations.length} Michigan Locations` : 'Michigan Locations'}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-tight drop-shadow-3xl mb-4 md:mb-5">
              Which Zap Zone are you visiting?
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-blue-100/90 leading-relaxed">
              Pick a location to see its packages, attractions and events — and to book without being
              asked which one you meant.
            </p>
          </div>

          <div className="max-w-xl mt-8 md:mt-10 animate-slide-up-delay pointer-events-auto">
            <div className="relative group">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-white/25 via-blue-300/25 to-blue-300/25 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative">
                <Search className="absolute left-4 md:left-5 top-1/2 transform -translate-y-1/2 text-blue-800" size={20} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by location or city..."
                  aria-label="Search locations by name or city"
                  className="w-full pl-12 md:pl-14 pr-12 py-4 text-sm md:text-base text-gray-900 bg-white rounded-xl border-0 focus:outline-none focus:ring-4 focus:ring-white/30 shadow-2xl placeholder-gray-400"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none"></div>
      </section>

      <main className="bg-gray-50 min-h-[50vh]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          {showSkeletons && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                  <div className="h-9 w-9 rounded-lg bg-gray-100 mb-4" />
                  <div className="h-4 w-2/3 bg-gray-100 rounded mb-2.5" />
                  <div className="h-3 w-full bg-gray-100 rounded mb-1.5" />
                  <div className="h-3 w-1/2 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          )}

          {loadFailed && (
            <div className="text-center py-16">
              <h2 className="text-xl font-bold text-gray-900 mb-2">We could not load our locations</h2>
              <p className="text-gray-600 mb-6">Something went wrong on our end. Please try again.</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-blue-800 text-white font-semibold rounded-xl hover:bg-blue-900 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {noLocationsPublished && (
            <div className="text-center py-16">
              <h2 className="text-xl font-bold text-gray-900 mb-2">No locations are published yet</h2>
              <p className="text-gray-600">Please check back shortly.</p>
            </div>
          )}

          {!showSkeletons && !loadFailed && !noLocationsPublished && visible.length === 0 && (
            <div className="text-center py-16">
              <p className="text-base font-semibold text-gray-900 mb-1.5">No location matches "{query}"</p>
              <p className="text-sm text-gray-500 mb-6">Try a city name such as Brighton, Canton or Taylor.</p>
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-sm font-semibold text-blue-800 hover:text-blue-900 transition-colors"
              >
                Show every location
              </button>
            </div>
          )}

          {visible.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((location, index) => {
                const tally = tallies[location.id];
                const counts = [
                  { noun: 'package', value: tally?.packages ?? 0 },
                  { noun: 'attraction', value: tally?.attractions ?? 0 },
                  { noun: 'event', value: tally?.events ?? 0 },
                ]
                  .filter((entry) => entry.value > 0)
                  .map((entry) => ({ ...entry, label: entry.value === 1 ? entry.noun : `${entry.noun}s` }));

                const { primary, secondary } = splitLocationName(location.name, location.city);

                return (
                  <article
                    key={location.id}
                    className={`flex flex-col bg-white border border-gray-200 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group card-hover animate-fade-in-up ${index < 5 ? `animate-stagger-${index + 1}` : ''}`}
                  >
                    <Link
                      to={`/${location.slug}`}
                      aria-label={`${location.name} — view and book`}
                      className="flex-1 flex flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-inset"
                    >
                      <div className="flex items-start gap-3 mb-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-800 transition-colors duration-300">
                          <MapPin className="w-5 h-5 text-blue-800 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg md:text-xl font-bold leading-snug truncate">
                            {primary}
                          </h2>
                          {secondary && (
                            <p className="text-xs font-medium text-gray-500 truncate mt-0.5">{secondary}</p>
                          )}
                        </div>
                      </div>

                      {addressLine(location) && (
                        <p className="flex items-start gap-2 text-sm text-gray-500 leading-relaxed mb-4">
                          <MapPin className="w-3.5 h-3.5 mt-1 flex-shrink-0 text-blue-600" aria-hidden="true" />
                          <span>
                            {addressLine(location)}
                            {location.zip_code ? ` ${location.zip_code}` : ''}
                          </span>
                        </p>
                      )}

                      {counts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-5">
                          {counts.map(({ noun, label, value }) => (
                            <span
                              key={noun}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 text-gray-600 text-xs rounded-lg"
                            >
                              <span className="font-bold text-gray-900 tabular-nums">{value}</span>
                              <span className="font-medium">{label}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto space-y-2.5">
                        <span className="w-full py-3 bg-gradient-to-r from-blue-800 to-blue-700 text-white font-semibold text-sm rounded-xl group-hover:from-blue-900 group-hover:to-blue-800 transition-all flex items-center justify-center gap-2 shadow-md group-hover:shadow-lg">
                          View &amp; Book
                          <ChevronRight className="w-4 h-4 transition-transform duration-300 motion-safe:group-hover:translate-x-1" />
                        </span>
                        <span className="block text-center text-[11px] text-gray-400 truncate">
                          /{location.slug}
                        </span>
                      </div>
                    </Link>

                    {location.phone && (
                      <div className="border-t border-gray-100 px-5 py-2.5 bg-gray-50/60">
                        <a
                          href={`tel:${location.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-blue-800 transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                          {location.phone}
                        </a>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {!showSkeletons && !loadFailed && !noLocationsPublished && (
            <div className="mt-10 md:mt-14 pt-8 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-500">
                Not sure which one yet? Browse everything we offer across all locations.
              </p>
              <Link
                to="/browse"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:text-blue-900 transition-colors whitespace-nowrap"
              >
                Browse all locations
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>
      </main>

      <SiteFooter showLocations={false} />
    </>
  );
};

export default LocationChooser;
