/**
 * Which tile imagery the map draws.
 *
 * Plain OpenStreetMap tiles are fine while developing but their usage policy does not permit
 * a commercial site to hotlink them, so production reads a provider key from the environment.
 * MapTiler and Stadia both have free tiers that do allow commercial use.
 */
export interface TileConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  /** False when we fell back to OpenStreetMap because no provider key was configured. */
  licensedForProduction: boolean;
  provider: 'maptiler' | 'stadia' | 'openstreetmap';
}

const env = (key: string): string => {
  // Guarded because this also runs outside Vite (tests, any server-side render), where
  // import.meta.env is not defined at all and a bare read throws.
  const source = (import.meta as { env?: Record<string, string | undefined> }).env;
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
};

export const tileConfig = (): TileConfig => {
  const mapTiler = env('VITE_MAPTILER_KEY');
  if (mapTiler) {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTiler}`,
      attribution:
        '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">&copy; MapTiler</a> ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>',
      maxZoom: 20,
      licensedForProduction: true,
      provider: 'maptiler',
    };
  }

  const stadia = env('VITE_STADIA_MAPS_KEY');
  if (stadia) {
    return {
      url: `https://tiles.stadiamaps.com/tiles/osm_bright/{z}/{x}/{y}{r}.png?api_key=${stadia}`,
      attribution:
        '<a href="https://stadiamaps.com/" target="_blank" rel="noopener">&copy; Stadia Maps</a> ' +
        '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>',
      maxZoom: 20,
      licensedForProduction: true,
      provider: 'stadia',
    };
  }

  return {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">&copy; OpenStreetMap contributors</a>',
    maxZoom: 19,
    licensedForProduction: false,
    provider: 'openstreetmap',
  };
};
