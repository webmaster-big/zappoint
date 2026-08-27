import { useEffect, useState } from 'react';
import { Phone, Navigation, ArrowRight } from 'lucide-react';
import type { StorefrontLocation } from '../../services/StorefrontLocationService';
import { getGuestIdentity, saveGuestIdentity } from '../../utils/guestIdentity';

const dropLegacyAck = () => {
  try {
    localStorage.removeItem('zapzone_location_ack');
    sessionStorage.removeItem('zapzone_location_ack');
  } catch {
    return undefined;
  }
};

const splitName = (name: string) => {
  const [venue, ...rest] = name.split('|').map(part => part.trim());
  return { venue: venue || name, brand: rest.join(' ').trim() };
};

const LocationConfirmModal = ({
  location,
  counts,
  onConfirm,
}: {
  location: StorefrontLocation;
  counts?: { packages: number; attractions: number; events: number };
  onConfirm?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!location?.slug) return;
    dropLegacyAck();

    if (getGuestIdentity()) {
      setOpen(false);
      return;
    }

    setOpen(true);
  }, [location?.slug]);

  if (!open || !location) return null;

  const { venue, brand } = splitName(location.name);
  const street = location.address?.trim();
  const cityZip = [[location.city, location.state].filter(Boolean).join(', '), location.zip_code]
    .filter(Boolean)
    .join(' ');
  const mapQuery = encodeURIComponent([location.name, street, cityZip].filter(Boolean).join(', '));

  const canContinue = name.trim().length >= 2 && phone.replace(/\D/g, '').length >= 7;

  const confirm = () => {
    if (!canContinue) return;
    saveGuestIdentity({ name: name.trim(), phone: phone.trim() }, location.id);
    setOpen(false);
    onConfirm?.();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="px-5 pt-5 pb-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Welcome to</p>
        </div>

        <div className="px-5 pt-2 space-y-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">{venue}</h2>
            {brand && <p className="text-xs font-semibold uppercase tracking-wider text-blue-800">{brand}</p>}
          </div>

          <div className="text-sm text-gray-700 leading-relaxed">
            {street && <div>{street}</div>}
            {cityZip && <div className="text-gray-500">{cityZip}</div>}
          </div>

          <div className="flex flex-wrap gap-2">
            {location.phone && (
              <a
                href={`tel:${location.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Phone size={13} />
                {location.phone}
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

          {counts && (
            <p className="text-xs text-gray-500">
              {counts.packages} packages · {counts.attractions} attractions · {counts.events} events here
            </p>
          )}

          <div className="pt-1 space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              Tell us who you are and we'll take you right in — the venue can help you faster with a
              name and number.
            </p>

            <div>
              <label htmlFor="guest-welcome-name" className="block text-sm font-medium text-gray-900 mb-1.5">
                Your name <span className="text-red-500">*</span>
              </label>
              <input
                id="guest-welcome-name"
                type="text"
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                placeholder="Jamie Rivera"
              />
            </div>

            <div>
              <label htmlFor="guest-welcome-phone" className="block text-sm font-medium text-gray-900 mb-1.5">
                Phone number <span className="text-red-500">*</span>
              </label>
              <input
                id="guest-welcome-phone"
                type="tel"
                value={phone}
                onChange={event => setPhone(event.target.value)}
                autoComplete="tel"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                placeholder="(810) 555-0134"
              />
            </div>
          </div>
        </div>

        <div className="p-5 pt-4">
          <button
            type="button"
            onClick={confirm}
            disabled={!canContinue}
            className="w-full bg-blue-800 hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 font-semibold rounded-xl inline-flex items-center justify-center gap-2 text-sm shadow-md"
          >
            Continue at {venue}
            <ArrowRight size={16} />
          </button>
          <p className="mt-2.5 text-[11px] text-gray-400 text-center leading-relaxed">
            Saved on this device so you only enter it once. We only use it to help with your visit and
            bookings — nothing is booked or charged.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LocationConfirmModal;
