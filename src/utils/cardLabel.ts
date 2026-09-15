export interface CardBearingPayment {
  status?: string | null;
  method?: string | null;
  card_type?: string | null;
  card_last_four?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  amount?: number | string | null;
  notes?: string | null;
  id?: number | string | null;
}

export interface CardIdentity {
  brand: string | null;
  lastFour: string;
  label: string;
}

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  mc: 'Mastercard',
  americanexpress: 'American Express',
  amex: 'American Express',
  discover: 'Discover',
  disc: 'Discover',
  jcb: 'JCB',
  dinersclub: 'Diners Club',
  diners: 'Diners Club',
  enroute: 'enRoute',
  unionpay: 'UnionPay',
  maestro: 'Maestro',
};

export function normalizeCardBrand(type?: string | null): string | null {
  const raw = String(type ?? '').trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z]/g, '');
  return BRANDS[key] ?? raw;
}

export function normalizeLastFour(lastFour?: string | null): string | null {
  const digits = String(lastFour ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

export function formatCardLabel(type?: string | null, lastFour?: string | null): string | null {
  const four = normalizeLastFour(lastFour);
  if (!four) return null;
  return `${normalizeCardBrand(type) ?? 'Card'} ending in ${four}`;
}

export function cardIdentity(type?: string | null, lastFour?: string | null): CardIdentity | null {
  const four = normalizeLastFour(lastFour);
  if (!four) return null;
  const brand = normalizeCardBrand(type);
  return { brand, lastFour: four, label: `${brand ?? 'Card'} ending in ${four}` };
}

export function formatMoney(value: unknown, fallback = '—'): string {
  const amount = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(amount) ? `$${amount.toFixed(2)}` : fallback;
}

export function cardFromPayments(payments?: CardBearingPayment[] | null): CardIdentity | null {
  if (!Array.isArray(payments) || payments.length === 0) return null;

  const withCard = payments.filter(p => normalizeLastFour(p?.card_last_four));
  if (withCard.length === 0) return null;

  const rank = (p: CardBearingPayment) => (p?.status === 'completed' ? 0 : 1);
  const when = (p: CardBearingPayment) => {
    const stamp = p?.paid_at ?? p?.created_at;
    const time = stamp ? Date.parse(stamp) : NaN;
    return Number.isNaN(time) ? Number(p?.id ?? 0) : time;
  };

  const best = [...withCard].sort((a, b) => rank(a) - rank(b) || when(b) - when(a))[0];

  return cardIdentity(best.card_type, best.card_last_four);
}
