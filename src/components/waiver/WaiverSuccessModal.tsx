import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { API_BASE_URL } from '../../utils/storage';

interface UpcomingEvent {
  id: number;
  name: string;
  price?: string | number | null;
  start_date?: string | null;
  end_date?: string | null;
  time_start?: string | null;
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

/** A run that already started reads as "through <end>" — printing its start date looks stale. */
const eventWhen = (event: UpcomingEvent) => {
  const today = new Date().toISOString().slice(0, 10);
  const start = (event.start_date || '').slice(0, 10);
  if (start && start >= today) return shortDate(event.start_date);
  const end = shortDate(event.end_date);
  return end ? `through ${end}` : null;
};

/** Everything here is best-effort: a kiosk must still confirm the waiver if marketing data fails. */
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

const WaiverSuccessModal = ({
  signerFirstName,
  locationId,
  autoCloseSeconds = 25,
  onStartNext,
}: Props) => {
  const [marketing, setMarketing] = useState<MarketingContent | null>(null);
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
    const tick = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(tick);
  }, []);

  const hasMarketing = !!marketing && (marketing.bookUrl || marketing.events.length > 0 || marketing.plan);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="waiver-success-title"
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden my-6"
      >
        <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 px-6 py-7 text-center">
          <img src="/Zap-Zone.png" alt="Zap Zone" className="h-12 mx-auto object-contain mb-4" />
          <div className="w-16 h-16 rounded-full bg-emerald-400/15 border border-emerald-300/40 flex items-center justify-center mx-auto mb-3">
            <svg className="w-9 h-9 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 id="waiver-success-title" className="text-2xl font-bold" style={{ color: 'white' }}>
            {signerFirstName ? `You're all set, ${signerFirstName}!` : "You're all set!"}
          </h1>
          <p className="text-blue-200 text-sm mt-1.5">
            Your waiver is signed and saved{marketing?.locationName ? ` at ${marketing.locationName}` : ''}.
          </p>
        </div>

        {hasMarketing && (
          <div className="px-6 py-5 border-b border-gray-100 space-y-4">
            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Before you go</h2>


            {marketing?.bookUrl && (
              <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                <div className="bg-white p-2 rounded-lg border border-gray-100 shrink-0">
                  <QRCodeSVG value={marketing.bookUrl} size={82} level="M" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Book your next visit</p>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Scan with your phone to see parties, escape rooms and passes, and book online.
                  </p>
                </div>
              </div>
            )}

            {marketing && marketing.events.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-2">Coming up here</p>
                <ul className="space-y-1.5">
                  {marketing.events.map((event) => {
                    const when = eventWhen(event);
                    const price = money(event.price);
                    return (
                      <li key={event.id} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-gray-800 font-medium">{event.name}</span>
                        <span className="text-gray-500 whitespace-nowrap">
                          {[when, price].filter(Boolean).join(' · ')}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {marketing?.plan && (
              <p className="text-xs text-gray-600 leading-relaxed">
                Visiting often? <span className="font-semibold text-gray-900">{marketing.plan.name}</span> starts at{' '}
                <span className="font-semibold text-gray-900">{money(marketing.plan.price)}</span> — ask our staff
                {marketing.phone ? ` or call ${marketing.phone}` : ''}.
              </p>
            )}
          </div>
        )}

        <div className="px-6 py-5">
          <button
            onClick={onStartNext}
            className="w-full py-3.5 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition"
          >
            Start Next Waiver
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2.5">
            {secondsLeft > 0 ? `Returning to a new waiver in ${secondsLeft}s` : 'Returning to a new waiver…'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WaiverSuccessModal;
