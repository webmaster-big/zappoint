import { PhoneCall, Phone } from 'lucide-react';

const CallToBookPanel = ({
  venueName,
  venuePhone,
  onRequestCall,
}: {
  venueName?: string | null;
  venuePhone?: string | null;
  onRequestCall: () => void;
}) => (
  <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-teal-100 text-teal-700 p-2 shrink-0">
        <PhoneCall size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-teal-900">This one is booked by phone</h3>
        <p className="text-xs text-teal-800/80 mt-1 leading-relaxed">
          There is no online schedule for this item — {venueName || 'the venue'} arranges these
          bookings personally. Call now, or leave your number and the team will call you back.
        </p>
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          {venuePhone && (
            <a
              href={`tel:${venuePhone}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white shadow-md"
            >
              <PhoneCall size={15} />
              Call {venuePhone}
            </a>
          )}
          <button
            type="button"
            onClick={onRequestCall}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-300 bg-white hover:bg-teal-100/50 px-4 py-2.5 text-sm font-semibold text-teal-800"
          >
            <Phone size={15} />
            Request a call back
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default CallToBookPanel;
