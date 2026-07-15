import React, { useEffect, useState } from 'react';
import { Ticket, Sparkles, Package as PackageIcon, Clock, Users, MapPin } from 'lucide-react';
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

export const attractionsForDate = (list: AttractionPurchase[], date: Date): AttractionPurchase[] => {
  const key = formatDateKey(date);
  return list.filter(p => (p.scheduled_date || p.purchase_date || '').split('T')[0] === key);
};

export const eventsForDate = (list: EventPurchase[], date: Date): EventPurchase[] => {
  const key = formatDateKey(date);
  return list.filter(p => (p.purchase_date || '').split('T')[0] === key);
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

export const AttractionScheduleCard: React.FC<{ purchase: AttractionPurchase }> = ({ purchase: p }) => {
  const guest = p.guest_name || (p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Guest');
  const scheduled = (p.scheduled_date || p.purchase_date || '').split('T')[0];
  return (
    <div className="border border-purple-200 rounded-lg p-4 bg-purple-50/40">
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
  );
};

export const EventScheduleCard: React.FC<{ purchase: EventPurchase }> = ({ purchase: p }) => {
  const guest = p.guest_name || (p.customer ? `${p.customer.first_name} ${p.customer.last_name}` : 'Guest');
  return (
    <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/40">
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
  );
};
