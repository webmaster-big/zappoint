import axios from 'axios';
import { API_BASE_URL } from './storage';
import { getVisitorId, isAnalyticsDnt } from './analyticsHeaders';

const GUEST_KEY = 'zapzone_guest';
const IDENTIFIED_FLAG_KEY = 'zapzone_guest_identified';

export interface GuestIdentity {
  name: string;
  phone: string;
  email?: string;
  savedAt?: string;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

const readStoredGuest = (): GuestIdentity | null => {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.name === 'string' && typeof parsed?.phone === 'string' && parsed.name.trim() && parsed.phone.trim()) {
      return parsed as GuestIdentity;
    }
    return null;
  } catch {
    return null;
  }
};

const readCustomerAccount = (): GuestIdentity | null => {
  try {
    const raw = localStorage.getItem('zapzone_customer');
    if (!raw) return null;
    const customer = JSON.parse(raw);
    const name = (customer?.name || `${customer?.firstName || customer?.first_name || ''} ${customer?.lastName || customer?.last_name || ''}`.trim() || '').trim();
    const phone = (customer?.phone || '').trim();
    if (name.length >= 2 && phone.replace(/\D/g, '').length >= 7) {
      return { name, phone, email: customer?.email || undefined };
    }
    return null;
  } catch {
    return null;
  }
};

export const getGuestIdentity = (): GuestIdentity | null => readStoredGuest() ?? readCustomerAccount();

export const hasGuestIdentity = (): boolean => getGuestIdentity() !== null;

const identityFingerprint = (identity: GuestIdentity): string =>
  `${getVisitorId()}|${identity.name.trim().toLowerCase()}|${identity.phone.replace(/\D/g, '')}`;

const sendIdentity = (identity: GuestIdentity, locationId?: number | null): void => {
  if (isAnalyticsDnt()) return;
  const fingerprint = identityFingerprint(identity);
  void api
    .post('/analytics/identify', {
      name: identity.name.trim(),
      phone: identity.phone.trim(),
      email: identity.email?.trim() || undefined,
      location_id: locationId ?? undefined,
      visitor_id: getVisitorId(),
    })
    .then(() => {
      try {
        sessionStorage.setItem(IDENTIFIED_FLAG_KEY, fingerprint);
      } catch {
        return undefined;
      }
    })
    .catch(() => undefined);
};

export const saveGuestIdentity = (identity: GuestIdentity, locationId?: number | null): void => {
  sendIdentity(identity, locationId);
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...identity, savedAt: new Date().toISOString() }));
  } catch {
    return undefined;
  }
};

export const ensureVisitorIdentified = (locationId?: number | null): void => {
  const identity = getGuestIdentity();
  if (!identity) return;
  try {
    if (sessionStorage.getItem(IDENTIFIED_FLAG_KEY) === identityFingerprint(identity)) return;
  } catch {
    return undefined;
  }
  sendIdentity(identity, locationId);
};
