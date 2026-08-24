import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Phone, Navigation, ArrowRight, X, ChevronDown } from 'lucide-react';
import type { StorefrontLocation } from '../../services/StorefrontLocationService';

const ACK_KEY = 'zapzone_location_ack';

const readAcks = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(ACK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
};

/** Venue names arrive as "Brighto | Zap Zone" — the town leads, the brand is a footnote. */
const splitName = (name: string) => {
  const [venue, ...rest] = name.split('|').map(part => part.trim());
  return { venue: venue || name, brand: rest.join(' ').trim() };
};

/**
 * Guests reach a venue page from search, a shared link or a QR code on a wall, and every
 * ZapZone looks alike once you are three taps into a booking. This confirms the venue —
 * and lets them switch right here instead of starting over somewhere else.
 */
const LocationConfirmModal = ({
  location,
  locations,
  counts,
  onConfirm,
}: {
  location: StorefrontLocation;
  locations: StorefrontLocation[];
  counts?: { packages: number; attractions: number; events: number };
  onConfirm?: () => void;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [chosenSlug, setChosenSlug] = useState(location?.slug ?? '');

  useEffect(() => {
    if (!location?.slug) return;
    setChosenSlug(location.slug);
    const seenAt = readAcks()[location.slug];
    // Ask again on a later visit — a returning guest may be at a different venue.
    setOpen(!(seenAt && Date.now() - seenAt < 24 * 60 * 60 * 1000));
  }, [location?.slug]);

  const ordered = useMemo(
    () => [...(locations ?? [])].sort((a, b) => splitName(a.name).venue.localeCompare(splitName(b.name).venue)),
    [locations],
  );

  const chosen = ordered.find(loc => loc.slug === chosenSlug) ?? location;
  const isCurrent = chosen?.slug === location?.slug;

  if (!open || !location) return null;

  const { venue, brand } = splitName(chosen.name);
  const street = chosen.address?.trim();
  const cityZip = [[chosen.city, chosen.state].filter(Boolean).join(', '), chosen.zip_code]
    .filter(Boolean)
    .join(' ');
  const mapQuery = encodeURIComponent([chosen.name, street, cityZip].filter(Boolean).join(', '));

  const confirm = () => {
    try {
      localStorage.setItem(ACK_KEY, JSON.stringify({ ...readAcks(), [chosen.slug]: Date.now() }));
    } catch {
      /* blocked storage just means we ask again next time */
    }
    setOpen(false);
    if (!isCurrent) {
      navigate(`/${chosen.slug}`);
      return;
    }
    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Your venue</p>
          <button
            type="button"
            onClick={confirm}
            aria-label="Close"
            className="p-1.5 -mr-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5">
          <label htmlFor="venue-picker" className="sr-only">
            Choose your venue
          </label>
          <div className="relative">
            <select
              id="venue-picker"
              value={chosenSlug}
              onChange={event => setChosenSlug(event.target.value)}
              className="w-full appearance-none rounded-xl border-2 border-blue-800 bg-white pl-11 pr-10 py-3 text-lg font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              {ordered.map(loc => {
                const parts = splitName(loc.name);
                return (
                  <option key={loc.slug} value={loc.slug}>
                    {parts.venue}
                    {loc.city ? ` — ${loc.city}, ${loc.state ?? ''}`.trimEnd() : ''}
                  </option>
                );
              })}
            </select>
            <MapPin size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-800" />
            <ChevronDown size={18} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
          <p className="mt-1.5 text-xs text-gray-500">
            {ordered.length} locations — pick yours to see its prices and times.
          </p>
        </div>

        <div className="px-5 pt-4 space-y-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{venue}</h2>
            {brand && <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">{brand}</p>}
          </div>

          <div className="text-sm text-gray-700 leading-relaxed">
            {street && <div>{street}</div>}
            {cityZip && <div className="text-gray-500">{cityZip}</div>}
          </div>

          <div className="flex flex-wrap gap-2">
            {chosen.phone && (
              <a
                href={`tel:${chosen.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Phone size={13} />
                {chosen.phone}
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <Navigation size={13} />
              Directions
            </a>
          </div>

          {isCurrent && counts && (
            <p className="text-xs text-gray-500">
              {counts.packages} packages · {counts.attractions} attractions · {counts.events} events here
            </p>
          )}
          {!isCurrent && (
            <p className="text-xs font-medium text-blue-800">Continue to load this venue's prices and times.</p>
          )}
        </div>

        <div className="p-5 pt-4">
          <button
            type="button"
            onClick={confirm}
            className="w-full bg-blue-800 hover:bg-blue-900 text-white px-4 py-3 font-semibold rounded-xl inline-flex items-center justify-center gap-2 text-sm shadow-md"
          >
            {isCurrent ? `Continue at ${venue}` : `Switch to ${venue}`}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationConfirmModal;
