import type { Booking } from '../services/bookingService';

interface CustomerRef {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface NamedRef {
  name?: string | null;
}

type SearchableBooking = Partial<Booking>;

const MIN_PHONE_DIGITS = 3;

export const digitsOnly = (value: string): string => value.replace(/\D+/g, '');

const customerOf = (booking: SearchableBooking): CustomerRef | null => {
  const customer = booking.customer;
  return customer && typeof customer === 'object' ? (customer as CustomerRef) : null;
};

const nameOfRelation = (relation: unknown): string => {
  if (!relation || typeof relation !== 'object') return '';
  return (relation as NamedRef).name?.trim() || '';
};

export const customerNameOf = (booking: SearchableBooking): string => {
  const guest = typeof booking.guest_name === 'string' ? booking.guest_name.trim() : '';
  if (guest) return guest;
  const customer = customerOf(booking);
  const full = customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() : '';
  return full || 'Guest';
};

export const customerPhoneOf = (booking: SearchableBooking): string => {
  const guest = typeof booking.guest_phone === 'string' ? booking.guest_phone.trim() : '';
  if (guest) return guest;
  return customerOf(booking)?.phone?.trim() || '';
};

const textHaystack = (booking: SearchableBooking): string => {
  const customer = customerOf(booking);
  return [
    booking.guest_name,
    booking.guest_email,
    booking.guest_phone,
    booking.guest_of_honor_name,
    booking.reference_number,
    customer?.first_name,
    customer?.last_name,
    customer ? `${customer.first_name ?? ''} ${customer.last_name ?? ''}` : '',
    customer?.email,
    customer?.phone,
    booking.package?.name,
    nameOfRelation(booking.room),
    nameOfRelation(booking.location),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

const phoneHaystack = (booking: SearchableBooking): string =>
  [booking.guest_phone, customerOf(booking)?.phone]
    .map(value => (typeof value === 'string' ? digitsOnly(value) : ''))
    .filter(Boolean)
    .join(' ');

const matchesTerm = (text: string, phones: string, term: string): boolean => {
  if (text.includes(term)) return true;
  const termDigits = digitsOnly(term);
  return termDigits.length >= MIN_PHONE_DIGITS && phones.includes(termDigits);
};

export const matchesBookingSearch = (booking: SearchableBooking, rawTerm: string): boolean => {
  const terms = rawTerm.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = textHaystack(booking);
  const phones = phoneHaystack(booking);
  return terms.every(term => matchesTerm(text, phones, term));
};

export const localPhoneDigits = (value?: string | null): string => {
  const digits = digitsOnly(String(value ?? ''));
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

export const isCompletePhone = (value?: string | null): boolean => {
  const raw = String(value ?? '').trim();
  if (localPhoneDigits(raw).length === 10) return true;
  return raw.startsWith('+') && digitsOnly(raw).length >= 8;
};

export const formatPhoneForDisplay = (value?: string | null): string => {
  if (!value) return '';
  const local = localPhoneDigits(value);
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};
