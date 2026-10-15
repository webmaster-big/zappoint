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

const cleanPhoneInput = (value?: string | null): string =>
  String(value ?? '')
    .replace(/\p{Cf}/gu, '')
    .replace(/[\uFF10-\uFF19]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xff10 + 48))
    .replace(/\uFF0B/g, '+')
    .replace(/\u00A0/g, ' ')
    .trim()
    .replace(/^[^\d+]*(?=\+)/, '');

const withoutExtension = (value?: string | null): string =>
  cleanPhoneInput(value).replace(/(\d)\s*(?:extension|ext\.?|x|#|,|;)\s*\d+\s*$/i, '$1');

export const localPhoneDigits = (value?: string | null): string => {
  const raw = withoutExtension(value);
  let digits = digitsOnly(raw);
  const dialOut = raw.match(/^(011|00)/);
  const afterDialOut = dialOut ? digits.slice(dialOut[0].length) : '';
  if (afterDialOut.length === 11 && afterDialOut.startsWith('1')) digits = afterDialOut;
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

const isDialledAbroad = (value?: string | null): boolean => {
  const raw = withoutExtension(value);
  const match = raw.match(/^(\+|011|00)/);
  if (!match) return false;
  return !digitsOnly(raw.slice(match[0].length)).startsWith('1');
};

export const needsCountryCode = (value?: string | null): boolean => {
  const raw = withoutExtension(value);
  if (!isDialledAbroad(raw)) return false;
  const afterPrefix = raw
    .replace(/^\s*(\+|011|00)\s*/, '')
    .replace(/^\(\s*0\s*\)/, '')
    .replace(/^[0\s]+/, '');
  const digits = digitsOnly(afterPrefix);
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return false;
  const group = afterPrefix.match(/^(\d{1,2})(?=\D)\D*\d/);
  return !(group && digits.startsWith(group[1]));
};

export const PHONE_NOT_RECOGNISED =
  'Please enter a 10-digit US or Canadian number, or start a number from another country with + and its country code.';

export const COUNTRY_CODE_NEEDED =
  'Please check the country code. Start a US or Canadian number with +1, or put a space after your country code, for example +47 912 34 567.';

export const phoneForSubmit = (value?: string | null): string => {
  const raw = cleanPhoneInput(value);
  if (isDialledAbroad(raw)) return raw;
  return localPhoneDigits(raw) || raw;
};

export const isCompletePhone = (value?: string | null): boolean => {
  const raw = withoutExtension(value);
  if (/^[2-9]\d{9}$/.test(localPhoneDigits(raw))) return true;
  const dialOut = raw.match(/^(\+|011|00)/);
  if (!dialOut) return false;
  const rest = digitsOnly(raw.slice(dialOut[0].length));
  return !rest.startsWith('1') && rest.length >= (dialOut[0] === '+' ? 8 : 9);
};

export const formatPhoneForDisplay = (value?: string | null): string => {
  if (!value) return '';
  const cleaned = cleanPhoneInput(value);
  if (isDialledAbroad(value) || withoutExtension(value) !== cleaned || digitsOnly(cleaned).length > 11) return value;
  const local = localPhoneDigits(value);
  if (local.length !== 10) return value;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
};
