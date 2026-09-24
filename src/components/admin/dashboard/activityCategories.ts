import type { Booking } from '../../../services/bookingService';
import type { AttractionPurchase } from '../../../services/AttractionPurchaseService';
import type { EventPurchase } from '../../../types/event.types';
import { normalizeCategory } from '../../../utils/venueCategories';

export type ActivityBucketKey =
  | 'party_packages'
  | 'attractions'
  | 'escape_rooms'
  | 'rage_rooms'
  | 'events';

export const RAGE_ROOM_CATEGORY = 'Rage Room';
export const ESCAPE_ROOM_CATEGORY = 'Escape Room';

const RAGE_ROOM_ALIASES = new Set([
  'rage room',
  'rage rooms',
  'rageroom',
  'ragerooms',
  'rage-room',
  'rage-rooms',
  'smash room',
  'smash rooms',
  'smashroom',
  'smashrooms',
  'smash-room',
  'smash-rooms',
]);

export const dashboardCategory = (value?: string | null): string => {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return '';
  if (RAGE_ROOM_ALIASES.has(trimmed.toLowerCase().replace(/\s+/g, ' '))) return RAGE_ROOM_CATEGORY;
  return normalizeCategory(trimmed);
};

export const bucketForCategory = (
  category: string | null | undefined,
  source: 'booking' | 'attraction',
): ActivityBucketKey => {
  const resolved = dashboardCategory(category);
  if (resolved === ESCAPE_ROOM_CATEGORY) return 'escape_rooms';
  if (resolved === RAGE_ROOM_CATEGORY) return 'rage_rooms';
  return source === 'attraction' ? 'attractions' : 'party_packages';
};

export const bucketForBooking = (booking: Pick<Booking, 'package'>): ActivityBucketKey =>
  bucketForCategory(booking.package?.category, 'booking');

export const bucketForPurchase = (purchase: Pick<AttractionPurchase, 'attraction'>): ActivityBucketKey =>
  bucketForCategory(purchase.attraction?.category, 'attraction');

const CANCELLED_BOOKING_STATUSES = ['cancelled'];
const CANCELLED_PURCHASE_STATUSES = ['cancelled', 'refunded'];

const statusOf = (value: unknown): string => String(value ?? '').toLowerCase();

export const countsAsBooking = (booking: Pick<Booking, 'status'>): boolean =>
  !CANCELLED_BOOKING_STATUSES.includes(statusOf(booking.status));

export const countsAsPurchase = (purchase: { status?: unknown }): boolean =>
  !CANCELLED_PURCHASE_STATUSES.includes(statusOf(purchase.status));

export interface ActivitySourceCount {
  label: string;
  count: number;
  category: string;
}

export interface ActivityBucket {
  key: ActivityBucketKey;
  label: string;
  primaryUnit: string;
  primary: number;
  secondaryUnit: string;
  secondary: number;
  cancelled: number;
  bookings: Booking[];
  purchases: AttractionPurchase[];
  eventPurchases: EventPurchase[];
  sources: ActivitySourceCount[];
  categories: string[];
  explanation: string;
}

interface BucketDefinition {
  key: ActivityBucketKey;
  label: string;
  primaryUnit: string;
  secondaryUnit: string;
  explanation: string;
}

export const BUCKET_DEFINITIONS: BucketDefinition[] = [
  {
    key: 'party_packages',
    label: 'Party Packages',
    primaryUnit: 'bookings',
    secondaryUnit: 'guests',
    explanation:
      'Package bookings scheduled for this day that are not escape rooms or rage rooms — birthdays, adventure parties and every other package category this store sells. Cancelled bookings are left out.',
  },
  {
    key: 'attractions',
    label: 'Wristbands & Attractions',
    primaryUnit: 'tickets',
    secondaryUnit: 'orders',
    explanation:
      'Attraction tickets scheduled for this day — wristbands, activities and open play. The headline number is tickets, so one order of six wristbands counts as six. Cancelled and refunded orders are left out.',
  },
  {
    key: 'escape_rooms',
    label: 'Escape Rooms',
    primaryUnit: 'bookings',
    secondaryUnit: 'players',
    explanation:
      'Escape room activity scheduled for this day, whether it was sold as a package booking or as an attraction ticket. Difficulty labels such as Beginner or Advanced count as escape rooms. Cancelled rows are left out.',
  },
  {
    key: 'rage_rooms',
    label: 'Rage Rooms',
    primaryUnit: 'bookings',
    secondaryUnit: 'guests',
    explanation:
      'Rage room activity scheduled for this day, whether it was sold as a package booking or as an attraction ticket. Smash room is treated as the same thing. Cancelled rows are left out.',
  },
  {
    key: 'events',
    label: 'Events',
    primaryUnit: 'tickets',
    secondaryUnit: 'registrations',
    explanation:
      'Event registrations for this day. The headline number is tickets, so a family of four on one registration counts as four. Cancelled and refunded registrations are left out.',
  },
];

const sortedSources = (rows: Map<string, ActivitySourceCount>): ActivitySourceCount[] =>
  [...rows.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

export interface ActivityInput {
  bookings?: Booking[];
  purchases?: AttractionPurchase[];
  events?: EventPurchase[];
}

export const buildActivityBuckets = (input: ActivityInput): ActivityBucket[] => {
  const buckets = new Map<ActivityBucketKey, ActivityBucket>();
  const sourceRows = new Map<ActivityBucketKey, Map<string, ActivitySourceCount>>();

  for (const definition of BUCKET_DEFINITIONS) {
    buckets.set(definition.key, {
      ...definition,
      primary: 0,
      secondary: 0,
      cancelled: 0,
      bookings: [],
      purchases: [],
      eventPurchases: [],
      sources: [],
      categories: [],
    });
    sourceRows.set(definition.key, new Map());
  }

  const addSource = (key: ActivityBucketKey, label: string, category: string, count: number) => {
    const rows = sourceRows.get(key);
    if (!rows) return;
    const existing = rows.get(label);
    if (existing) {
      existing.count += count;
      return;
    }
    rows.set(label, { label, category, count });
  };

  const noteCategory = (bucket: ActivityBucket, category: string) => {
    const resolved = category.trim();
    if (resolved === '' || bucket.categories.includes(resolved)) return;
    bucket.categories.push(resolved);
  };

  for (const booking of input.bookings ?? []) {
    const bucket = buckets.get(bucketForBooking(booking));
    if (!bucket) continue;
    if (!countsAsBooking(booking)) {
      bucket.cancelled += 1;
      continue;
    }
    const category = dashboardCategory(booking.package?.category) || 'No category';
    bucket.bookings.push(booking);
    bucket.primary += 1;
    bucket.secondary += Number(booking.participants) || 0;
    noteCategory(bucket, category);
    addSource(bucket.key, booking.package?.name || 'Other package', category, 1);
  }

  for (const purchase of input.purchases ?? []) {
    const bucket = buckets.get(bucketForPurchase(purchase));
    if (!bucket) continue;
    if (!countsAsPurchase(purchase)) {
      bucket.cancelled += 1;
      continue;
    }
    const tickets = Number(purchase.quantity) || 0;
    const category = dashboardCategory(purchase.attraction?.category) || 'No category';
    bucket.purchases.push(purchase);
    noteCategory(bucket, category);

    if (bucket.key === 'attractions') {
      bucket.primary += tickets;
      bucket.secondary += 1;
      addSource(bucket.key, purchase.attraction?.name || 'Other attraction', category, tickets);
    } else {
      bucket.primary += 1;
      bucket.secondary += tickets;
      addSource(bucket.key, purchase.attraction?.name || 'Other attraction', category, 1);
    }
  }

  const eventBucket = buckets.get('events');
  for (const purchase of input.events ?? []) {
    if (!eventBucket) break;
    if (!countsAsPurchase(purchase)) {
      eventBucket.cancelled += 1;
      continue;
    }
    const tickets = Number(purchase.quantity) || 0;
    eventBucket.eventPurchases.push(purchase);
    eventBucket.primary += tickets;
    eventBucket.secondary += 1;
    addSource('events', purchase.event?.name || 'Other event', 'Events', tickets);
  }

  return BUCKET_DEFINITIONS.map(definition => {
    const bucket = buckets.get(definition.key) as ActivityBucket;
    bucket.sources = sortedSources(sourceRows.get(definition.key) ?? new Map());
    return bucket;
  });
};

export const bucketItemCount = (bucket: ActivityBucket): number =>
  bucket.bookings.length + bucket.purchases.length + bucket.eventPurchases.length;
