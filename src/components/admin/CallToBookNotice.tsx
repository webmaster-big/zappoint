import { PhoneCall, CalendarCheck2, EyeOff } from 'lucide-react';

const CallToBookNotice = ({
  active,
  itemLabel,
  backendOnly = false,
  switchedOff = false,
}: {
  active: boolean;
  itemLabel: 'package' | 'attraction' | 'event';
  backendOnly?: boolean;
  switchedOff?: boolean;
}) =>
  backendOnly ? (
    <div className="rounded-md border border-amber-200 amber-tone bg-amber-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <EyeOff size={16} className="text-amber-700 mt-0.5 shrink-0" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-bold text-sm">Backend only — not on the booking site</p>
          <p className="mt-1">
            Front-End Availability is off, so customers cannot see this {itemLabel} or book it online.{' '}
            {switchedOff
              ? 'It is switched off right now, so staff can book it from the admin booking pages once it is switched on.'
              : 'Staff can still book it from the admin booking pages.'}
          </p>
          {active && (
            <p className="mt-1">
              Its schedule does not give it any bookable dates and times yet. Complete the schedule so staff can pick a date and time when they book it.
            </p>
          )}
        </div>
      </div>
    </div>
  ) : active ? (
    <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <PhoneCall size={16} className="text-teal-700 mt-0.5 shrink-0" />
        <div className="text-xs text-teal-900 leading-relaxed">
          <p className="font-bold text-sm">No schedule — customers will see "Call to Book"</p>
          <p className="mt-1">
            Because this {itemLabel} has no availability schedule, customers cannot pick a date or time
            online. On the customer site the usual booking button is replaced with a{' '}
            <span className="font-semibold">Call to Book</span> button that shows your venue's name and
            phone number, lets guests call with one tap, or leave their name, number and a message
            asking to be called back.
          </p>
          <p className="mt-1">
            Those requests appear under <span className="font-semibold">Customers → Customer Concerns</span>{' '}
            marked "Call to book", and every active staff member at the venue is emailed and texted right
            away. Add a schedule at any time to switch back to normal online booking.
          </p>
        </div>
      </div>
    </div>
  ) : (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <CalendarCheck2 size={16} className="text-emerald-700 mt-0.5 shrink-0" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <p className="font-bold text-sm">Bookable online</p>
          <p className="mt-1">
            This {itemLabel} has a schedule, so customers can pick a date and time and pay online. If you
            remove every schedule, the customer site shows a{' '}
            <span className="font-semibold">Call to Book</span> button instead — guests are asked to call
            the venue or request a call back, and nothing can be booked or paid online.
          </p>
        </div>
      </div>
    </div>
  );

export default CallToBookNotice;
