import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../../utils/storage';

/** One thing worth mentioning on the way out. */
interface Pick {
  key: string;
  label: string;
  name: string;
  price: string | null;
  was: string | null;
  when: string | null;
  rank: number;
}

interface Takeaway {
  bookUrl: string | null;
  locationName: string | null;
  phone: string | null;
  picks: Pick[];
}

interface Props {
  signerFirstName?: string;
  locationId: number | null;
  autoCloseSeconds?: number;
  onStartNext: () => void;
}

/** How long the plain confirmation holds before the takeaway slides in. */
const CONFIRM_BEAT_MS = 2000;
const MAX_PICKS = 3;

const today = () => new Date().toISOString().slice(0, 10);

const money = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
};

const shortDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** A run already under way reads "through <end>" — its start date would look stale. */
const eventWhen = (start?: string | null, end?: string | null) => {
  const from = (start || '').slice(0, 10);
  if (from && from >= today()) return shortDate(start);
  const until = shortDate(end);
  return until ? `through ${until}` : null;
};

const perPerson = (pricingType?: string | null) => (pricingType === 'per_person' ? '/person' : '');

type SpecialPricing = { has_special_pricing?: boolean; original_price?: number; discounted_price?: number };

/** What this venue charges today, and what it charged before any automatic discount. */
const priceNow = (sp: SpecialPricing | undefined, fallback: unknown, pricingType?: string | null) => {
  const suffix = perPerson(pricingType);
  const discounted = sp?.has_special_pricing ? money(sp.discounted_price) : null;
  const base = money(sp?.original_price ?? fallback);
  if (discounted && base && discounted !== base) {
    return { price: `${discounted}${suffix}`, was: base, discounted: true };
  }
  return { price: base ? `${base}${suffix}` : null, was: null, discounted: false };
};

const shuffle = <T,>(list: T[]) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * One pick per label, best first, ties broken at random — so a venue with escape
 * rooms, wristbands and an event shows a spread of all three rather than three
 * escape rooms, and two guests in a row do not see the same list.
 */
const spread = (pool: Pick[]): Pick[] => {
  const byLabel = new Map<string, Pick[]>();
  pool.forEach((pick) => {
    const list = byLabel.get(pick.label);
    if (list) list.push(pick);
    else byLabel.set(pick.label, [pick]);
  });

  const champions = [...byLabel.values()].map((list) => {
    const best = Math.max(...list.map((p) => p.rank));
    return shuffle(list.filter((p) => p.rank === best))[0];
  });

  return shuffle(champions)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_PICKS);
};

interface CatalogLocation {
  location_id: number;
  package_id?: number;
  attraction_id?: number;
  special_pricing?: SpecialPricing;
}

const atLocation = (entry: { locations?: CatalogLocation[] }, locationId: number): CatalogLocation | undefined =>
  (entry.locations ?? []).find((l) => Number(l.location_id) === Number(locationId));

/** Best-effort: the waiver must still confirm if none of this loads. */
const loadTakeaway = async (locationId: number | null): Promise<Takeaway> => {
  const empty: Takeaway = { bookUrl: null, locationName: null, phone: null, picks: [] };
  if (locationId === null) return empty;

  const getJson = async (path: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };
  const list = (res: unknown): any[] => {
    const body = res as { data?: unknown } | unknown[];
    if (Array.isArray(body)) return body;
    const inner = (body as { data?: unknown })?.data;
    return Array.isArray(inner) ? inner : [];
  };

  const [locationsRes, packagesRes, attractionsRes, eventsRes, plansRes] = await Promise.all([
    getJson('/storefront/locations'),
    getJson('/packages/grouped-by-name'),
    getJson('/attractions/grouped'),
    getJson(`/events/location/${locationId}`),
    getJson('/membership-plans/public'),
  ]);

  const venue = list(locationsRes).find((l) => Number(l.id) === Number(locationId));
  const pool: Pick[] = [];

  // packages carry their venue label in display_label; category holds the escape-room difficulty
  list(packagesRes).forEach((pkg) => {
    const here = atLocation(pkg, locationId);
    if (!here) return;
    const label = String(pkg.display_label || pkg.category || 'Packages').trim();
    const { price, was, discounted } = priceNow(here.special_pricing ?? pkg.special_pricing, pkg.price, pkg.pricing_type);
    if (!price) return;
    pool.push({ key: `pkg-${here.package_id}`, label, name: pkg.name, price, was, when: null, rank: discounted ? 3 : 1 });
  });

  list(attractionsRes).forEach((attr) => {
    const here = atLocation(attr, locationId);
    if (!here) return;
    const label = String(attr.category || 'Activities').trim();
    const { price, was, discounted } = priceNow(here.special_pricing ?? attr.special_pricing, attr.price, attr.pricing_type);
    if (!price) return;
    pool.push({ key: `attr-${here.attraction_id}`, label, name: attr.name, price, was, when: null, rank: discounted ? 3 : 1 });
  });

  list(eventsRes).forEach((evt) => {
    if (evt.is_active === false) return;
    const until = (evt.end_date || evt.start_date || '').slice(0, 10);
    if (until && until < today()) return;
    pool.push({
      key: `evt-${evt.id}`,
      label: 'Events',
      name: evt.name,
      price: money(evt.price),
      was: null,
      when: eventWhen(evt.start_date, evt.end_date),
      // dated, so it is the one thing that stops being true if they wait
      rank: 2,
    });
  });

  list(plansRes).forEach((plan) => {
    if (plan.is_active === false) return;
    const price = money(plan.price);
    if (!price) return;
    pool.push({ key: `plan-${plan.id}`, label: 'Passes', name: plan.name, price, was: null, when: null, rank: 1 });
  });

  return {
    bookUrl: venue?.slug ? `${window.location.origin}/${venue.slug}` : null,
    locationName: venue?.name ?? null,
    phone: venue?.phone ?? null,
    picks: spread(pool),
  };
};

const WaiverSuccessModal = ({ signerFirstName, locationId, autoCloseSeconds = 25, onStartNext }: Props) => {
  const [takeaway, setTakeaway] = useState<Takeaway | null>(null);
  const [beatDone, setBeatDone] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);

  useEffect(() => {
    let alive = true;
    loadTakeaway(locationId).then((data) => {
      if (alive) setTakeaway(data);
    });
    return () => {
      alive = false;
    };
  }, [locationId]);

  useEffect(() => {
    const out = setTimeout(() => setHandingOver(true), CONFIRM_BEAT_MS);
    const swap = setTimeout(() => setBeatDone(true), CONFIRM_BEAT_MS + 220);
    return () => {
      clearTimeout(out);
      clearTimeout(swap);
    };
  }, []);

  useEffect(() => {
    const tick = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, []);

  const hasTakeaway = !!takeaway && !!(takeaway.bookUrl || takeaway.picks.length > 0);
  const showTakeaway = beatDone && hasTakeaway;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/55 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiver-success-title"
        className="zz-card-in bg-white w-full max-w-md rounded-2xl border border-gray-100 shadow-xl overflow-hidden my-6"
      >
        {!showTakeaway ? (
          <div className={`px-8 py-11 text-center ${handingOver && hasTakeaway ? 'zz-step-out' : 'zz-step-in'}`}>
            <div className="zz-ring-in w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <svg className="zz-tick w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 id="waiver-success-title" className="text-[22px] font-bold text-gray-900 leading-snug">
              {signerFirstName ? `You're all set, ${signerFirstName}!` : "You're all set!"}
            </h1>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Your waiver is signed and saved{takeaway?.locationName ? ` at ${takeaway.locationName}` : ''}.
            </p>

            {beatDone && !hasTakeaway && (
              <button
                onClick={onStartNext}
                className="zz-step-in mt-8 w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                Start Next Waiver
              </button>
            )}
          </div>
        ) : (
          <div className="zz-step-in px-7 py-6">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-100">
              <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <svg className="w-3 h-3 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <p className="text-xs font-semibold text-gray-500">
                Waiver signed{signerFirstName ? ` — thanks, ${signerFirstName}` : ''}
              </p>
            </div>

            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-3">
              While you&rsquo;re here
            </h2>

            {takeaway && takeaway.picks.length > 0 && (
              <ul className="divide-y divide-gray-100 border-y border-gray-100">
                {takeaway.picks.map((pick) => (
                  <li key={pick.key} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{pick.label}</p>
                      <p className="text-[13px] font-medium text-gray-800 truncate">{pick.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {pick.price && (
                        <p className="text-[13px] font-semibold text-gray-900 tabular-nums">
                          {pick.was && <span className="font-normal text-gray-400 line-through mr-1.5">{pick.was}</span>}
                          {pick.price}
                        </p>
                      )}
                      {pick.when && <p className="text-[11px] text-gray-500">{pick.when}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {takeaway?.bookUrl && (
              <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-3.5 mt-4">
                <div className="bg-white p-1.5 rounded-lg border border-blue-100 shrink-0">
                  <QRCodeSVG value={takeaway.bookUrl} size={72} level="M" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">See everything on offer</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Scan to browse and book at this venue
                    {takeaway.phone ? `, or call ${takeaway.phone}` : ''}.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={onStartNext}
              className="mt-5 w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
            >
              Start Next Waiver
            </button>
            <p className="text-[11px] text-gray-400 text-center mt-2.5 tabular-nums">
              {secondsLeft > 0 ? `Returning to a new waiver in ${secondsLeft}s` : 'Returning to a new waiver…'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WaiverSuccessModal;
