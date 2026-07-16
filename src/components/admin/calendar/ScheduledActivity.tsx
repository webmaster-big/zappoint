import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket, Sparkles, Package as PackageIcon, Clock, Users, MapPin, X, Eye, Edit } from 'lucide-react';
import attractionPurchaseService, { type AttractionPurchase } from '../../../services/AttractionPurchaseService';
import eventPurchaseService from '../../../services/EventPurchaseService';
import type { EventPurchase } from '../../../types/event.types';
import { getStoredUser } from '../../../utils/storage';

export interface ScheduledRange {
  from: string;
  to: string;
}

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatTime12Hour = (time24?: string | null): string => {
  if (!time24) return '';
  const [hours24, minutes] = time24.split(':');
  const hours = parseInt(hours24, 10);
  if (Number.isNaN(hours)) return '';
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes ?? '00'} ${period}`;
};

const timeToMinutes = (time?: string | null): number => {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [h, m] = time.split(':');
  const hours = parseInt(h, 10);
  if (Number.isNaN(hours)) return Number.MAX_SAFE_INTEGER;
  const mins = parseInt(m ?? '0', 10);
  return hours * 60 + (Number.isNaN(mins) ? 0 : mins);
};

export const attractionsForDate = (list: AttractionPurchase[], date: Date): AttractionPurchase[] => {
  const key = formatDateKey(date);
  return list
    .filter(p => (p.scheduled_date || p.purchase_date || '').split('T')[0] === key)
    .sort((a, b) => timeToMinutes(a.scheduled_time) - timeToMinutes(b.scheduled_time));
};

export const eventsForDate = (list: EventPurchase[], date: Date): EventPurchase[] => {
  const key = formatDateKey(date);
  return list
    .filter(p => (p.purchase_date || '').split('T')[0] === key)
    .sort((a, b) => timeToMinutes(a.purchase_time) - timeToMinutes(b.purchase_time));
};

export interface DaySummary {
  bookings: number;
  attractionTickets: number;
  eventRegistrations: number;
  total: number;
}

export const getDaySummary = (
  bookingCount: number,
  attractions: AttractionPurchase[],
  events: EventPurchase[]
): DaySummary => ({
  bookings: bookingCount,
  attractionTickets: attractions.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
  eventRegistrations: events.length,
  total: bookingCount + attractions.length + events.length,
});

export function useScheduledExtras(
  range: ScheduledRange | null,
  locationId?: number | null
): { attractions: AttractionPurchase[]; events: EventPurchase[] } {
  const [attractions, setAttractions] = useState<AttractionPurchase[]>([]);
  const [events, setEvents] = useState<EventPurchase[]>([]);

  const from = range?.from;
  const to = range?.to;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!from || !to) {
        setAttractions([]);
        setEvents([]);
        return;
      }

      const userId = getStoredUser()?.id;

      try {
        const collected: AttractionPurchase[] = [];
        let page = 1;
        let lastPage = 1;
        do {
          const response = await attractionPurchaseService.getPurchases({
            scheduled_from: from,
            scheduled_to: to,
            per_page: 100,
            page,
            user_id: userId,
            location_id: locationId ?? undefined,
          });
          collected.push(...(response?.data?.purchases || []));
          lastPage = response?.data?.pagination?.last_page ?? 1;
          page += 1;
        } while (page <= lastPage && page <= 50);
        if (!cancelled) setAttractions(collected);
      } catch (error) {
        console.error('Error loading attraction purchases:', error);
        if (!cancelled) setAttractions([]);
      }

      try {
        const response = await eventPurchaseService.getPurchases({
          start_date: from,
          end_date: to,
          user_id: userId,
          location_id: locationId ?? undefined,
        });
        const raw = response as unknown;
        const list = Array.isArray(raw)
          ? (raw as EventPurchase[])
          : ((raw as { data?: EventPurchase[] })?.data ?? []);
        if (!cancelled) setEvents(list);
      } catch (error) {
        console.error('Error loading event purchases:', error);
        if (!cancelled) setEvents([]);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [from, to, locationId]);

  return { attractions, events };
}

const statusPillClass = (status?: string): string => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'checked-in': return 'bg-blue-100 text-blue-800';
    case 'completed': return 'bg-gray-100 text-gray-800';
    case 'refunded': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

export const DateActivityBreakdown: React.FC<{ summary: DaySummary; className?: string }> = ({ summary, className }) => {
  if (summary.total === 0) return null;

  const rows: Array<{ key: string; icon: React.ReactNode; label: string; className: string }> = [];
  if (summary.bookings > 0) {
    rows.push({
      key: 'bookings',
      icon: <PackageIcon className="h-3 w-3 flex-shrink-0" />,
      label: `${summary.bookings} Booking${summary.bookings !== 1 ? 's' : ''}`,
      className: 'bg-blue-100 text-blue-800',
    });
  }
  if (summary.attractionTickets > 0) {
    rows.push({
      key: 'attractions',
      icon: <Ticket className="h-3 w-3 flex-shrink-0" />,
      label: `${summary.attractionTickets} Attraction Ticket${summary.attractionTickets !== 1 ? 's' : ''}`,
      className: 'bg-purple-100 text-purple-800',
    });
  }
  if (summary.eventRegistrations > 0) {
    rows.push({
      key: 'events',
      icon: <Sparkles className="h-3 w-3 flex-shrink-0" />,
      label: `${summary.eventRegistrations} Event Registration${summary.eventRegistrations !== 1 ? 's' : ''}`,
      className: 'bg-amber-100 text-amber-800',
    });
  }

  return (
    <div className={`space-y-1 ${className ?? ''}`}>
      {rows.map(row => (
        <div
          key={row.key}
          className={`flex items-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium leading-tight ${row.className}`}
        >
          {row.icon}
          <span className="truncate">{row.label}</span>
        </div>
      ))}
    </div>
  );
};

const formatDateLong = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  const parts = dateStr.split('T')[0].split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex justify-between items-center gap-4">
    <span className="text-sm text-gray-600">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right">{children}</span>
  </div>
);

const PurchaseDetailModal: React.FC<{
  title: string;
  typeLabel: string;
  typeClass: string;
  icon: React.ReactNode;
  viewHref: string;
  editHref: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, typeLabel, typeClass, icon, viewHref, editHref, onClose, children }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
    <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
              <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full ${typeClass}`}>{typeLabel}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {children}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 flex flex-wrap gap-2">
          <Link
            to={viewHref}
            onClick={onClose}
            className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye size={15} /> View
          </Link>
          <Link
            to={editHref}
            onClick={onClose}
            className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit size={15} /> Edit
          </Link>
          <button
            onClick={onClose}
            className="flex-1 min-w-[110px] inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
);

export const AttractionScheduleCard: React.FC<{ purchase: AttractionPurchase }> = ({ purchase: p }) => {
  const [open, setOpen] = useState(false);
  const guest = p.guest_name || (p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Guest');
  const scheduled = (p.scheduled_date || p.purchase_date || '').split('T')[0];
  const email = p.guest_email || p.customer?.email;
  const phone = p.guest_phone || p.customer?.phone;
  const addOns = p.add_ons || [];
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="border border-purple-200 rounded-lg p-4 bg-purple-50/40 cursor-pointer hover:shadow-md hover:border-purple-300 transition"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Ticket className="h-4 w-4 text-purple-600 flex-shrink-0" />
              <h4 className="font-medium text-gray-900 text-base">{p.attraction?.name || 'Attraction'}</h4>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{guest}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusPillClass(p.status)}`}>{p.status}</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">Attraction</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 text-gray-400 mr-2" />
            <span>{p.scheduled_time ? formatTime12Hour(p.scheduled_time) : 'Any time'}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Ticket className="h-4 w-4 text-gray-400 mr-2" />
            <span>{p.quantity} ticket{p.quantity !== 1 ? 's' : ''}</span>
          </div>
          {p.attraction?.location?.name ? (
            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <span className="truncate">{p.attraction.location.name}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 pt-3 border-t border-purple-100 flex justify-between items-center">
          <span className="text-xs text-gray-500">Scheduled {scheduled}</span>
          <span className="text-sm font-medium text-gray-900">${Number(p.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {open && (
        <PurchaseDetailModal
          title={p.attraction?.name || 'Attraction'}
          typeLabel="Attraction Purchase"
          typeClass="bg-purple-100 text-purple-800"
          icon={<Ticket className="h-6 w-6 text-purple-600 flex-shrink-0" />}
          viewHref={`/attractions/purchases/${p.id}?from=calendar`}
          editHref={`/attractions/purchases/${p.id}?from=calendar`}
          onClose={() => setOpen(false)}
        >
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-gray-400 mr-3" />
              <span className="font-medium text-gray-900">{guest}</span>
            </div>
            {email ? <div className="text-sm text-gray-600 ml-7">{email}</div> : null}
            {phone ? <div className="text-sm text-gray-600 ml-7">{phone}</div> : null}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <DetailRow label="Status"><span className={`px-3 py-1 text-xs font-medium rounded-full ${statusPillClass(p.status)}`}>{p.status}</span></DetailRow>
            <DetailRow label="Scheduled Date">{formatDateLong(scheduled)}</DetailRow>
            <DetailRow label="Time">{p.scheduled_time ? formatTime12Hour(p.scheduled_time) : 'Any time'}</DetailRow>
            <DetailRow label="Tickets">{p.quantity}</DetailRow>
            {p.attraction?.location?.name ? <DetailRow label="Location">{p.attraction.location.name}</DetailRow> : null}
          </div>
          {addOns.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 uppercase mb-2">Add-ons</p>
              <div className="space-y-1">
                {addOns.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{a.name}{a.pivot?.quantity ? ` ×${a.pivot.quantity}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <DetailRow label="Payment Method"><span className="capitalize">{p.payment_method || 'N/A'}</span></DetailRow>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-medium text-gray-900">Total Amount</span>
              <span className="font-semibold text-gray-900 text-lg">${Number(p.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </PurchaseDetailModal>
      )}
    </>
  );
};

export const EventScheduleCard: React.FC<{ purchase: EventPurchase }> = ({ purchase: p }) => {
  const [open, setOpen] = useState(false);
  const guest = p.guest_name || (p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Guest');
  const email = p.guest_email || p.customer?.email;
  const phone = p.guest_phone || p.customer?.phone;
  const addOns = p.add_ons || [];
  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className="border border-amber-200 rounded-lg p-4 bg-amber-50/40 cursor-pointer hover:shadow-md hover:border-amber-300 transition"
      >
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <h4 className="font-medium text-gray-900 text-base">{p.event?.name || 'Event'}</h4>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{guest}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`px-3 py-1 text-xs font-medium rounded-full ${statusPillClass(p.status)}`}>{p.status}</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Event</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center text-gray-600">
            <Clock className="h-4 w-4 text-gray-400 mr-2" />
            <span>{p.purchase_time ? formatTime12Hour(p.purchase_time) : '—'}</span>
          </div>
          <div className="flex items-center text-gray-600">
            <Users className="h-4 w-4 text-gray-400 mr-2" />
            <span>{p.quantity} ticket{p.quantity !== 1 ? 's' : ''}</span>
          </div>
          {p.location?.name ? (
            <div className="flex items-center text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <span className="truncate">{p.location.name}</span>
            </div>
          ) : null}
        </div>
        <div className="mt-3 pt-3 border-t border-amber-100 flex justify-between items-center">
          <span className="text-xs text-gray-500 font-mono">#{p.reference_number}</span>
          <span className="text-sm font-medium text-gray-900">${Number(p.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {open && (
        <PurchaseDetailModal
          title={p.event?.name || 'Event'}
          typeLabel="Event Registration"
          typeClass="bg-amber-100 text-amber-800"
          icon={<Sparkles className="h-6 w-6 text-amber-600 flex-shrink-0" />}
          viewHref={`/events/purchases/${p.id}?from=calendar`}
          editHref={`/events/purchases/${p.id}?from=calendar`}
          onClose={() => setOpen(false)}
        >
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center">
              <Users className="h-4 w-4 text-gray-400 mr-3" />
              <span className="font-medium text-gray-900">{guest}</span>
            </div>
            {email ? <div className="text-sm text-gray-600 ml-7">{email}</div> : null}
            {phone ? <div className="text-sm text-gray-600 ml-7">{phone}</div> : null}
          </div>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <DetailRow label="Reference"><span className="font-mono">#{p.reference_number}</span></DetailRow>
            <DetailRow label="Status"><span className={`px-3 py-1 text-xs font-medium rounded-full ${statusPillClass(p.status)}`}>{p.status}</span></DetailRow>
            <DetailRow label="Event Date">{formatDateLong(p.purchase_date)}</DetailRow>
            <DetailRow label="Time">{p.purchase_time ? formatTime12Hour(p.purchase_time) : '—'}</DetailRow>
            <DetailRow label="Tickets">{p.quantity}</DetailRow>
            {p.location?.name ? <DetailRow label="Location">{p.location.name}</DetailRow> : null}
          </div>
          {addOns.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs font-medium text-gray-600 uppercase mb-2">Add-ons</p>
              <div className="space-y-1">
                {addOns.map((a, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{a.name}{a.pivot?.quantity ? ` ×${a.pivot.quantity}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <DetailRow label="Payment Method"><span className="capitalize">{p.payment_method || 'N/A'}</span></DetailRow>
            <DetailRow label="Payment Status"><span className="capitalize">{p.payment_status || 'N/A'}</span></DetailRow>
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-medium text-gray-900">Total Amount</span>
              <span className="font-semibold text-gray-900 text-lg">${Number(p.total_amount).toFixed(2)}</span>
            </div>
          </div>
        </PurchaseDetailModal>
      )}
    </>
  );
};
