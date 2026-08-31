import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../../utils/storage';

interface UpcomingEvent {
  id: number;
  name: string;
  price?: string | number | null;
  start_date?: string | null;
  end_date?: string | null;
}

interface MarketingContent {
  bookUrl: string | null;
  locationName: string | null;
  phone: string | null;
  events: UpcomingEvent[];
  plan: { name: string; price: string } | null;
}

interface Props {
  signerFirstName?: string;
  locationId: number | null;
  autoCloseSeconds?: number;
  onStartNext: () => void;
}

/** How long the plain confirmation holds before the takeaway slides in. */
const CONFIRM_BEAT_MS = 2000;

const money = (value: string | number | null | undefined) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(2)}` : null;
};

const shortDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/** A run already under way reads "through <end>" — printing its start date looks stale. */
const eventWhen = (event: UpcomingEvent) => {
  const today = new Date().toISOString().slice(0, 10);
  const start = (event.start_date || '').slice(0, 10);
  if (start && start >= today) return shortDate(event.start_date);
  const end = shortDate(event.end_date);
  return end ? `through ${end}` : null;
};

/** Best-effort: a kiosk must still confirm the waiver if any of this fails to load. */
const loadMarketing = async (locationId: number | null): Promise<MarketingContent> => {
  const empty: MarketingContent = { bookUrl: null, locationName: null, phone: null, events: [], plan: null };
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

  const [locationsRes, eventsRes, plansRes] = await Promise.all([
    getJson('/storefront/locations'),
    getJson(`/events/location/${locationId}`),
    getJson('/membership-plans/public'),
  ]);

  const locations = Array.isArray(locationsRes?.data) ? locationsRes.data : Array.isArray(locationsRes) ? locationsRes : [];
  const venue = locations.find((l: { id: number }) => Number(l.id) === Number(locationId));

  const rawEvents = Array.isArray(eventsRes?.data) ? eventsRes.data : Array.isArray(eventsRes) ? eventsRes : [];
  const today = new Date().toISOString().slice(0, 10);
  const events: UpcomingEvent[] = rawEvents
    .filter((e: UpcomingEvent & { is_active?: boolean }) => {
      if (e.is_active === false) return false;
      const until = (e.end_date || e.start_date || '').slice(0, 10);
      return !until || until >= today;
    })
    .slice(0, 2);

  const rawPlans = Array.isArray(plansRes?.data) ? plansRes.data : Array.isArray(plansRes) ? plansRes : [];
  const cheapest = rawPlans
    .filter((p: { is_active?: boolean; price?: string }) => p.is_active !== false && Number(p.price) > 0)
    .sort((a: { price: string }, b: { price: string }) => Number(a.price) - Number(b.price))[0];

  return {
    bookUrl: venue?.slug ? `${window.location.origin}/${venue.slug}` : null,
    locationName: venue?.name ?? null,
    phone: venue?.phone ?? null,
    events,
    plan: cheapest ? { name: cheapest.name, price: cheapest.price } : null,
  };
};

const WaiverSuccessModal = ({ signerFirstName, locationId, autoCloseSeconds = 25, onStartNext }: Props) => {
  const [marketing, setMarketing] = useState<MarketingContent | null>(null);
  const [beatDone, setBeatDone] = useState(false);
  const [handingOver, setHandingOver] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(autoCloseSeconds);

  useEffect(() => {
    let alive = true;
    loadMarketing(locationId).then((data) => {
      if (alive) setMarketing(data);
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

  const hasTakeaway = !!marketing && !!(marketing.bookUrl || marketing.events.length > 0 || marketing.plan);
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
              Your waiver is signed and saved{marketing?.locationName ? ` at ${marketing.locationName}` : ''}.
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

            <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-5 mb-3">Before you go</h2>

            {marketing?.bookUrl && (
              <div className="flex items-center gap-4 rounded-xl border border-blue-100 bg-blue-50 p-3.5">
                <div className="bg-white p-1.5 rounded-lg border border-blue-100 shrink-0">
                  <QRCodeSVG value={marketing.bookUrl} size={78} level="M" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Book your next visit</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Scan with your phone to see parties, escape rooms and passes, and book online.
                  </p>
                </div>
              </div>
            )}

            {marketing && marketing.events.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">Coming up here</p>
                <ul className="divide-y divide-gray-100 border-y border-gray-100">
                  {marketing.events.map((event) => {
                    const when = eventWhen(event);
                    const price = money(event.price);
                    return (
                      <li key={event.id} className="flex items-baseline justify-between gap-3 py-2 text-xs">
                        <span className="font-medium text-gray-800">{event.name}</span>
                        <span className="text-gray-500 whitespace-nowrap tabular-nums">
                          {[when, price].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {marketing?.plan && (
              <p className="text-xs text-gray-500 leading-relaxed mt-4">
                Visiting often? <span className="font-semibold text-gray-800">{marketing.plan.name}</span> starts at{' '}
                <span className="font-semibold text-gray-800">{money(marketing.plan.price)}</span> — ask our staff
                {marketing.phone ? ` or call ${marketing.phone}` : ''}.
              </p>
            )}

            <button
              onClick={onStartNext}
              className="mt-6 w-full py-3.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
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
