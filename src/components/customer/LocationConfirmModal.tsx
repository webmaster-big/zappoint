import { useEffect, useState } from 'react';
import { MapPin, Phone, Mail, Navigation, Check, ChevronRight, X } from 'lucide-react';
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

/**
 * Guests reach a venue page from search, a shared link or a QR code on a wall, and
 * every ZapZone looks alike once you are three taps into a booking. Confirming the
 * venue up front — with the address they can check against the door they walked in
 * through — is cheaper than a ticket bought for the wrong town.
 */
const LocationConfirmModal = ({
  location,
  counts,
  onConfirm,
  onSwitch,
}: {
  location: StorefrontLocation;
  counts?: { packages: number; attractions: number; events: number };
  onConfirm?: () => void;
  onSwitch: () => void;
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!location?.slug) return;
    const acks = readAcks();
    const seenAt = acks[location.slug];
    // Re-ask after a day so a returning guest on a new visit still gets the check.
    const fresh = seenAt && Date.now() - seenAt < 24 * 60 * 60 * 1000;
    setOpen(!fresh);
  }, [location?.slug]);

  const remember = () => {
    try {
      localStorage.setItem(ACK_KEY, JSON.stringify({ ...readAcks(), [location.slug]: Date.now() }));
    } catch {
      /* a blocked storage just means we ask again next time */
    }
  };

  const confirm = () => {
    remember();
    setOpen(false);
    onConfirm?.();
  };

  if (!open || !location) return null;

  const streetLine = location.address?.trim();
  const cityLine = [location.city, location.state].filter(Boolean).join(', ');
  const cityZip = [cityLine, location.zip_code].filter(Boolean).join(' ');
  const mapQuery = encodeURIComponent(
    [location.name, streetLine, cityZip].filter(Boolean).join(', '),
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">You are booking at</p>
            <h2 className="text-xl font-bold text-gray-900 mt-1">{location.name}</h2>
          </div>
          <button
            type="button"
            onClick={confirm}
            aria-label="Close"
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pb-4 space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-blue-800 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-800">
                {streetLine && <div className="font-medium">{streetLine}</div>}
                {cityZip && <div className="text-gray-600">{cityZip}</div>}
                {!streetLine && !cityZip && <div className="text-gray-500">Address available at the venue</div>}
              </div>
            </div>
            {location.phone && (
              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-blue-800 shrink-0" />
                <a href={`tel:${location.phone}`} className="text-sm text-gray-800 hover:text-blue-800">
                  {location.phone}
                </a>
              </div>
            )}
            {location.email && (
              <div className="flex items-center gap-2.5">
                <Mail size={16} className="text-blue-800 shrink-0" />
                <a href={`mailto:${location.email}`} className="text-sm text-gray-800 hover:text-blue-800 break-all">
                  {location.email}
                </a>
              </div>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-800 hover:text-blue-900"
            >
              <Navigation size={14} />
              Open in Maps
            </a>
          </div>

          {counts && (
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Packages', value: counts.packages },
                { label: 'Attractions', value: counts.attractions },
                { label: 'Events', value: counts.events },
              ].map(stat => (
                <div key={stat.label} className="rounded-lg border border-gray-200 py-2">
                  <div className="text-lg font-bold text-gray-900 tabular-nums">{stat.value}</div>
                  <div className="text-[11px] text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Prices, times and availability on this page are for this venue only.
          </p>
        </div>

        <div className="p-5 pt-0 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={confirm}
            className="flex-1 bg-blue-800 hover:bg-blue-900 text-white px-4 py-2.5 font-semibold rounded-lg inline-flex items-center justify-center gap-2 text-sm shadow-md"
          >
            <Check size={16} />
            Yes, this is my location
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSwitch();
            }}
            className="flex-1 border border-gray-300 text-gray-700 hover:bg-gray-50 px-4 py-2.5 font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 text-sm"
          >
            Pick another location
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationConfirmModal;
