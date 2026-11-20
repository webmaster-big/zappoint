import type { AppliedFee } from './fees';
import { normalizeCategory } from './venueCategories';

export type CustomPricingType = 'per_booking' | 'per_guest';
export type CustomFeeType = 'flat' | 'percent';

export interface CustomFeeInput {
  name: string;
  type: CustomFeeType;
  amount: string;
}

export interface OneTimeAddOnInput {
  name: string;
  quantity: string;
  unitPrice: string;
}

export interface CustomTermsInput {
  name: string;
  category: string;
  durationMinutes: string;
  minGuests: string;
  maxGuests: string;
  pricingType: CustomPricingType;
  price: string;
  fees: CustomFeeInput[];
  oneTimeAddOns: OneTimeAddOnInput[];
}

export interface CustomFee {
  name: string;
  type: CustomFeeType;
  amount: number;
}

export interface OneTimeAddOn {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OneTimeAddOnLine extends OneTimeAddOn {
  total: number;
}

export interface CustomTerms {
  name: string;
  category: string;
  durationMinutes: number;
  minGuests: number;
  maxGuests: number;
  pricingType: CustomPricingType;
  price: number;
  fees: CustomFee[];
  oneTimeAddOns: OneTimeAddOn[];
}

export interface CustomPackageTermsJson {
  min_guests: number;
  max_guests: number;
  fees: { name: string; type: CustomFeeType; amount: number }[];
  one_time_add_ons: { name: string; quantity: number; unit_price: number }[];
}

export interface CustomPackagePayload {
  name: string;
  category: string;
  duration_minutes: number;
  min_guests: number | null;
  max_guests: number;
  pricing_type: CustomPricingType;
  price: number;
  fees: { name: string; type: CustomFeeType; amount: number }[];
  one_time_add_ons: { name: string; quantity: number; unit_price: number }[];
}

export interface CustomBookingSource {
  is_custom_package?: boolean | number | null;
  isCustom?: boolean | null;
  custom_package_name?: string | null;
  custom_package_category?: string | null;
  custom_package_terms?: CustomPackageTermsJson | string | null;
  package_price_at_booking?: string | number | null;
  package_pricing_type_at_booking?: string | null;
  duration?: string | number | null;
  duration_unit?: string | null;
  package?: { name?: string | null; category?: string | null; display_label?: string | null } | null;
  customTerms?: CustomTerms | null;
  oneTimeAddOns?: OneTimeAddOnLine[] | null;
}

export interface CustomQuoteLineInput {
  unitPrice: number;
  quantity: number;
}

export interface CustomQuoteInput {
  pricingType: CustomPricingType;
  price: number;
  participants: number;
  catalog?: CustomQuoteLineInput[];
  oneTime?: CustomQuoteLineInput[];
  fees?: CustomFee[];
}

export interface CustomQuoteFee extends CustomFee {
  cents: number;
  label: string;
}

export interface CustomQuote {
  packageCents: number;
  catalogCents: number;
  oneTimeCents: number;
  subtotalCents: number;
  fees: CustomQuoteFee[];
  feesCents: number;
  totalCents: number;
}

export interface CustomAppliedFee extends AppliedFee {
  fee_application_type: 'additive';
  fee_calculation_type: 'fixed' | 'percentage';
  fee_label: string;
  fee_support_id: null;
}

export interface CustomCatalogLineCheck {
  id: number | string;
  name: string;
  quantity: number | string | null | undefined;
  minQuantity?: number | string | null;
  maxQuantity?: number | string | null;
}

export interface CustomValidationContext {
  participants?: number | string | null;
  locationId?: number | string | null;
  roomId?: number | string | null;
  catalog?: CustomCatalogLineCheck[];
  amountPaid?: number | string | null;
  totalCents?: number | null;
}

export type CustomTermsErrors = Record<string, string>;
export type CustomFeeField = 'name' | 'amount';
export type OneTimeAddOnField = 'name' | 'quantity' | 'unitPrice';

export const CUSTOM_PACKAGE_LABEL = 'Custom Package';
export const ONE_TIME_ADD_ONS_LABEL = 'One-time add-ons';
export const CUSTOM_BADGE_TEXT = 'Custom';

export const CUSTOM_PACKAGE_LIMITS = {
  nameMaxLength: 120,
  lineNameMaxLength: 100,
  durationMaxMinutes: 1440,
  guestsMax: 10000,
  priceMax: 99999.99,
  percentMax: 100,
  oneTimeQuantityMax: 1000,
  catalogQuantityMax: 99,
  feesMax: 20,
  oneTimeAddOnsMax: 50,
  totalMax: 99999999.99,
} as const;

export const CUSTOM_PACKAGE_MESSAGES = {
  nameRequired: 'Enter a name.',
  nameTooLong: 'Booking name can be at most 120 characters.',
  categoryRequired: 'Choose a category.',
  durationRequired: 'Enter a duration in minutes.',
  durationInvalid: 'Duration must be whole minutes from 1 to 1,440.',
  minGuestsInvalid: 'Min. guests must be a whole number from 1 to 10,000.',
  maxGuestsRequired: 'Enter the maximum number of guests.',
  maxGuestsInvalid: 'Max. guests must be a whole number from 1 to 10,000.',
  maxGuestsBelowMin: (min: number): string => `Max. guests must be at least ${min}.`,
  priceRequired: 'Enter a price.',
  priceInvalid: 'Price must be from $0.00 to $99,999.99, with at most 2 decimals.',
  participantsOutOfRange: (min: number, max: number): string => `Participants must be between ${min} and ${max}.`,
  lineNameRequired: 'Enter a name.',
  lineNameTooLong: 'Name can be at most 100 characters.',
  feeAmountRequired: 'Enter an amount.',
  feeAmountInvalid: 'Amount must be from $0.00 to $99,999.99, with at most 2 decimals.',
  feeRateRequired: 'Enter a rate.',
  feeRateInvalid: 'Rate must be from 0 to 100, with at most 2 decimals.',
  tooManyFees: 'A custom package can have at most 20 fees.',
  quantityInvalid: 'Quantity must be a whole number from 1 to 1,000.',
  unitPriceRequired: 'Enter a unit price.',
  unitPriceInvalid: 'Unit price must be from $0.00 to $99,999.99, with at most 2 decimals.',
  tooManyOneTimeAddOns: 'A custom package can have at most 50 one-time add-ons.',
  locationRequired: 'Choose a location for this booking.',
  spaceRequired: 'Choose a space for this booking.',
  noSpaces: 'No spaces at this location yet. Type a name to add one.',
  catalogBelowMinimum: (min: number): string => `Enter zero or at least ${min}.`,
  catalogOutOfRange: (name: string, min: number, max: number): string =>
    `${name} needs a quantity between ${min} and ${max}.`,
  amountPaidOverTotal: 'Amount paid cannot exceed the total.',
  totalTooLarge: 'The total cannot be more than $99,999,999.99.',
  categoriesFailed: 'Categories could not be loaded.',
  noCategories: 'No categories are set up yet. Add one on Create Package first.',
  capacityFromCustomPackage: 'Capacity comes from the custom package',
} as const;

const MONEY_MAX_CENTS = 9999999;
const TOTAL_MAX_CENTS = 9999999999;
const RATE_MAX_BASIS_POINTS = 10000;
const MINUTES_PER_DAY = 1440;

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const parseNumberInput = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const finiteOr = (value: unknown, fallback: number): number => parseNumberInput(value) ?? fallback;

const numberOrNaN = (value: unknown): number => parseNumberInput(value) ?? Number.NaN;

const positiveWhole = (value: unknown): number | null => {
  const parsed = parseNumberInput(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

const wholeCount = (value: unknown): number => {
  const parsed = parseNumberInput(value);
  return parsed !== null && parsed > 0 ? Math.floor(parsed) : 0;
};

const textOf = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

const hasAtMostTwoDecimals = (value: number): boolean => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

const isWholeWithin = (value: number, min: number, max: number): boolean =>
  Number.isInteger(value) && value >= min && value <= max;

const isCentsAmountWithin = (value: number, maxCents: number): boolean =>
  value >= 0 && hasAtMostTwoDecimals(value) && toCents(value) <= maxCents;

const hasId = (value: unknown): boolean => {
  const parsed = parseNumberInput(value);
  return parsed !== null && parsed > 0;
};

export function toCents(value: unknown): number {
  const parsed = parseNumberInput(value);
  if (parsed === null) return 0;
  const cents = Math.round(Math.abs(parsed) * 100);
  return parsed < 0 && cents > 0 ? -cents : cents;
}

const nonNegativeCents = (value: unknown): number => Math.max(0, toCents(value));

export function centsToDollars(cents: number): number {
  if (!Number.isFinite(cents)) return 0;
  const rounded = Math.round(cents);
  return rounded === 0 ? 0 : rounded / 100;
}

export function formatMoney(cents: number): string {
  return moneyFormatter.format(centsToDollars(cents));
}

const rateText = (amount: unknown): string => String(Number((toCents(amount) / 100).toFixed(2)));

export function feeLabel(type: CustomFeeType, amount: number | string | null | undefined): string {
  return type === 'percent' ? `${rateText(amount)}%` : formatMoney(toCents(amount));
}

export function feeLineLabel(fee: { name: string; type: CustomFeeType; amount: number | string | null | undefined }): string {
  const name = textOf(fee.name).trim();
  if (fee.type !== 'percent') return name;
  const rate = feeLabel('percent', fee.amount);
  return name ? `${name} (${rate})` : rate;
}

export function pricingTypeLabel(type: CustomPricingType): string {
  return type === 'per_guest' ? 'Per guest' : 'Per booking';
}

export function priceFieldLabel(type: CustomPricingType): string {
  return type === 'per_guest' ? 'Price per Guest' : 'Package Price';
}

export function packageLineLabel(
  pricingType: CustomPricingType,
  participants: number | string | null | undefined,
  price: number | string | null | undefined,
): string {
  if (pricingType !== 'per_guest') return 'Package';
  return `Package · ${wholeCount(participants)} × ${formatMoney(nonNegativeCents(price))}`;
}

export function durationText(minutes: number | string | null | undefined): string {
  const total = positiveWhole(minutes);
  if (total === null) return '';
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`;
}

const guestsText = (count: number): string => `${count} ${count === 1 ? 'guest' : 'guests'}`;

export function capacityText(min: number | string | null | undefined, max: number | string | null | undefined): string {
  const low = positiveWhole(min);
  const high = positiveWhole(max);
  if (high === null || (low !== null && low > high)) return '';
  if (low === high) return guestsText(high);
  if (low === null) return `Up to ${guestsText(high)}`;
  return `${low}–${high} guests`;
}

export function customGuestRange(
  min: number | string | null | undefined,
  max: number | string | null | undefined,
): { min: number; max: number } | null {
  const low = positiveWhole(min);
  const high = positiveWhole(max);
  if (high === null || (low !== null && low > high)) return null;
  return { min: low ?? 1, max: high };
}

export function participantsHint(min: number | string | null | undefined, max: number | string | null | undefined): string {
  const range = customGuestRange(min, max);
  return range ? `Min: ${range.min} • Max: ${range.max}` : CUSTOM_PACKAGE_MESSAGES.capacityFromCustomPackage;
}

export function endTimeText(
  date: string | null | undefined,
  time: string | null | undefined,
  minutes: number | string | null | undefined,
): string {
  const duration = positiveWhole(minutes);
  const match = /^(\d{1,2}):(\d{2})/.exec(textOf(time).trim());
  if (!textOf(date).trim() || !match || duration === null) return '';
  const startHour = Number(match[1]);
  const startMinute = Number(match[2]);
  if (startHour > 23 || startMinute > 59) return '';
  const end = startHour * 60 + startMinute + duration;
  const endOfDay = end % MINUTES_PER_DAY;
  const hour24 = Math.floor(endOfDay / 60);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const text = `Ends ${hour12}:${String(endOfDay % 60).padStart(2, '0')} ${hour24 >= 12 ? 'PM' : 'AM'}`;
  return end >= MINUTES_PER_DAY ? `${text} (next day)` : text;
}

export function isCustomBooking(b: CustomBookingSource | null | undefined): boolean {
  if (!b) return false;
  return b.is_custom_package === true || b.is_custom_package === 1 || b.isCustom === true;
}

export function bookingDisplayName(b: CustomBookingSource | null | undefined, fallback: string): string {
  if (isCustomBooking(b)) {
    const customName = textOf(b?.custom_package_name ?? b?.customTerms?.name).trim();
    return customName || CUSTOM_PACKAGE_LABEL;
  }
  const packageName = textOf(b?.package?.name).trim();
  return packageName || fallback;
}

export function bookingCategoryOf(b: CustomBookingSource | null | undefined, packageCategory?: string | null): string {
  if (isCustomBooking(b)) return normalizeCategory(b?.custom_package_category ?? b?.customTerms?.category);
  if (packageCategory !== undefined) return packageCategory ?? '';
  return b?.package?.display_label || b?.package?.category || '';
}

const readTermsJson = (value: unknown): Partial<Record<keyof CustomPackageTermsJson, unknown>> | null => {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as Partial<Record<keyof CustomPackageTermsJson, unknown>>;
};

const listOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    : [];

const durationMinutesFrom = (duration: unknown, unit: unknown): number => {
  const value = parseNumberInput(duration);
  if (value === null || value <= 0) return 0;
  if (unit === 'hours') return Math.round(value * 60);
  if (unit === 'hours and minutes') return Math.floor(value) * 60 + Math.round((value % 1) * 60);
  return Math.round(value);
};

export function customTermsOf(b: CustomBookingSource | null | undefined): CustomTerms | null {
  if (!b || !isCustomBooking(b)) return null;
  if (b.customTerms) return b.customTerms;
  const terms = readTermsJson(b.custom_package_terms);
  if (!terms) return null;
  return {
    name: textOf(b.custom_package_name),
    category: textOf(b.custom_package_category),
    durationMinutes: durationMinutesFrom(b.duration, b.duration_unit),
    minGuests: positiveWhole(terms.min_guests) ?? 1,
    maxGuests: positiveWhole(terms.max_guests) ?? 0,
    pricingType: b.package_pricing_type_at_booking === 'per_person' ? 'per_guest' : 'per_booking',
    price: finiteOr(b.package_price_at_booking, 0),
    fees: listOf(terms.fees).map((fee): CustomFee => ({
      name: textOf(fee.name),
      type: fee.type === 'percent' ? 'percent' : 'flat',
      amount: finiteOr(fee.amount, 0),
    })),
    oneTimeAddOns: listOf(terms.one_time_add_ons).map((line): OneTimeAddOn => ({
      name: textOf(line.name),
      quantity: finiteOr(line.quantity, 0),
      unitPrice: finiteOr(line.unit_price, 0),
    })),
  };
}

export function customTermsMissing(b: CustomBookingSource | null | undefined): boolean {
  return isCustomBooking(b) && customTermsOf(b) === null;
}

export function oneTimeAddOnsOf(b: CustomBookingSource | null | undefined): OneTimeAddOnLine[] {
  if (!b || !isCustomBooking(b)) return [];
  if (Array.isArray(b.oneTimeAddOns)) return b.oneTimeAddOns;
  const terms = customTermsOf(b);
  if (!terms) return [];
  return terms.oneTimeAddOns.map((line): OneTimeAddOnLine => ({
    name: line.name,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    total: centsToDollars(nonNegativeCents(line.unitPrice) * wholeCount(line.quantity)),
  }));
}

const sumLines = (lines: CustomQuoteLineInput[]): number =>
  lines.reduce((sum, line) => sum + nonNegativeCents(line.unitPrice) * wholeCount(line.quantity), 0);

export function computeCustomQuote(input: CustomQuoteInput): CustomQuote {
  const guests = input.pricingType === 'per_guest' ? wholeCount(input.participants) : 1;
  const packageCents = nonNegativeCents(input.price) * guests;
  const catalogCents = sumLines(input.catalog ?? []);
  const oneTimeCents = sumLines(input.oneTime ?? []);
  const subtotalCents = packageCents + catalogCents + oneTimeCents;
  const fees = (input.fees ?? []).map((fee): CustomQuoteFee => {
    const type: CustomFeeType = fee.type === 'percent' ? 'percent' : 'flat';
    const amount = finiteOr(fee.amount, 0);
    const cents = type === 'percent'
      ? Math.floor((subtotalCents * nonNegativeCents(amount) + 5000) / 10000)
      : nonNegativeCents(amount);
    return { name: textOf(fee.name).trim(), type, amount, cents, label: feeLabel(type, amount) };
  });
  const feesCents = fees.reduce((sum, fee) => sum + fee.cents, 0);
  return {
    packageCents,
    catalogCents,
    oneTimeCents,
    subtotalCents,
    fees,
    feesCents,
    totalCents: subtotalCents + feesCents,
  };
}

export function customQuoteFromInput(
  input: CustomTermsInput,
  participants: number | string | null | undefined,
  catalog: CustomQuoteLineInput[] = [],
): CustomQuote {
  return computeCustomQuote({
    pricingType: input.pricingType,
    price: finiteOr(input.price, 0),
    participants: finiteOr(participants, 0),
    catalog,
    oneTime: input.oneTimeAddOns.map((line) => ({
      unitPrice: finiteOr(line.unitPrice, 0),
      quantity: finiteOr(line.quantity, 0),
    })),
    fees: input.fees.map((fee) => ({ name: fee.name, type: fee.type, amount: finiteOr(fee.amount, 0) })),
  });
}

export function customQuoteFromTerms(
  terms: CustomTerms,
  participants: number | string | null | undefined,
  catalog: CustomQuoteLineInput[] = [],
): CustomQuote {
  return computeCustomQuote({
    pricingType: terms.pricingType,
    price: terms.price,
    participants: finiteOr(participants, 0),
    catalog,
    oneTime: terms.oneTimeAddOns,
    fees: terms.fees,
  });
}

export function toAppliedFees(quote: Pick<CustomQuote, 'fees'>): CustomAppliedFee[] {
  return quote.fees.map((fee): CustomAppliedFee => ({
    fee_name: fee.name,
    fee_amount: centsToDollars(fee.cents),
    fee_application_type: 'additive',
    fee_calculation_type: fee.type === 'percent' ? 'percentage' : 'fixed',
    fee_label: fee.label,
    fee_support_id: null,
  }));
}

export function customPackagePayload(input: CustomTermsInput): CustomPackagePayload {
  return {
    name: input.name.trim(),
    category: input.category.trim(),
    duration_minutes: numberOrNaN(input.durationMinutes),
    min_guests: parseNumberInput(input.minGuests),
    max_guests: numberOrNaN(input.maxGuests),
    pricing_type: input.pricingType === 'per_guest' ? 'per_guest' : 'per_booking',
    price: numberOrNaN(input.price),
    fees: input.fees.map((fee): CustomPackagePayload['fees'][number] => ({
      name: fee.name.trim(),
      type: fee.type === 'percent' ? 'percent' : 'flat',
      amount: numberOrNaN(fee.amount),
    })),
    one_time_add_ons: input.oneTimeAddOns.map((line): CustomPackagePayload['one_time_add_ons'][number] => ({
      name: line.name.trim(),
      quantity: numberOrNaN(line.quantity),
      unit_price: numberOrNaN(line.unitPrice),
    })),
  };
}

export function emptyCustomTermsInput(): CustomTermsInput {
  return {
    name: '',
    category: '',
    durationMinutes: '',
    minGuests: '',
    maxGuests: '',
    pricingType: 'per_booking',
    price: '',
    fees: [],
    oneTimeAddOns: [],
  };
}

export function emptyCustomFeeInput(): CustomFeeInput {
  return { name: '', type: 'flat', amount: '' };
}

export function emptyOneTimeAddOnInput(): OneTimeAddOnInput {
  return { name: '', quantity: '1', unitPrice: '' };
}

const moneyInputText = (value: number): string => (nonNegativeCents(value) / 100).toFixed(2);

export function customTermsInputFrom(terms: CustomTerms): CustomTermsInput {
  return {
    name: terms.name,
    category: terms.category,
    durationMinutes: terms.durationMinutes > 0 ? String(terms.durationMinutes) : '',
    minGuests: terms.minGuests > 0 ? String(terms.minGuests) : '',
    maxGuests: terms.maxGuests > 0 ? String(terms.maxGuests) : '',
    pricingType: terms.pricingType,
    price: moneyInputText(terms.price),
    fees: terms.fees.map((fee): CustomFeeInput => ({
      name: fee.name,
      type: fee.type,
      amount: fee.type === 'percent' ? rateText(fee.amount) : moneyInputText(fee.amount),
    })),
    oneTimeAddOns: terms.oneTimeAddOns.map((line): OneTimeAddOnInput => ({
      name: line.name,
      quantity: String(line.quantity),
      unitPrice: moneyInputText(line.unitPrice),
    })),
  };
}

export function feeErrorKey(index: number, field: CustomFeeField): string {
  return `fees.${index}.${field}`;
}

export function oneTimeAddOnErrorKey(index: number, field: OneTimeAddOnField): string {
  return `oneTimeAddOns.${index}.${field}`;
}

export function catalogErrorKey(id: number | string): string {
  return `catalog.${id}`;
}

const lineNameError = (value: string): string | null => {
  const name = textOf(value).trim();
  if (!name) return CUSTOM_PACKAGE_MESSAGES.lineNameRequired;
  if (name.length > CUSTOM_PACKAGE_LIMITS.lineNameMaxLength) return CUSTOM_PACKAGE_MESSAGES.lineNameTooLong;
  return null;
};

export function validateCustomTerms(input: CustomTermsInput, context: CustomValidationContext = {}): CustomTermsErrors {
  const messages = CUSTOM_PACKAGE_MESSAGES;
  const limits = CUSTOM_PACKAGE_LIMITS;
  const errors: CustomTermsErrors = {};

  if (context.locationId !== undefined && !hasId(context.locationId)) errors.location = messages.locationRequired;

  const name = textOf(input.name).trim();
  if (!name) errors.name = messages.nameRequired;
  else if (name.length > limits.nameMaxLength) errors.name = messages.nameTooLong;

  if (!textOf(input.category).trim()) errors.category = messages.categoryRequired;

  const duration = parseNumberInput(input.durationMinutes);
  if (duration === null) errors.durationMinutes = messages.durationRequired;
  else if (!isWholeWithin(duration, 1, limits.durationMaxMinutes)) errors.durationMinutes = messages.durationInvalid;

  const minGuests = parseNumberInput(input.minGuests);
  const minValid = minGuests === null || isWholeWithin(minGuests, 1, limits.guestsMax);
  if (!minValid) errors.minGuests = messages.minGuestsInvalid;

  const maxGuests = parseNumberInput(input.maxGuests);
  let capacity: { min: number; max: number } | null = null;
  if (maxGuests === null) errors.maxGuests = messages.maxGuestsRequired;
  else if (!isWholeWithin(maxGuests, 1, limits.guestsMax)) errors.maxGuests = messages.maxGuestsInvalid;
  else if (minValid && minGuests !== null && minGuests > maxGuests) errors.maxGuests = messages.maxGuestsBelowMin(minGuests);
  else if (minValid) capacity = { min: minGuests ?? 1, max: maxGuests };

  if (context.participants !== undefined && capacity) {
    const participants = parseNumberInput(context.participants);
    if (participants === null || !isWholeWithin(participants, capacity.min, capacity.max)) {
      errors.participants = messages.participantsOutOfRange(capacity.min, capacity.max);
    }
  }

  const price = parseNumberInput(input.price);
  if (price === null) errors.price = messages.priceRequired;
  else if (!isCentsAmountWithin(price, MONEY_MAX_CENTS)) errors.price = messages.priceInvalid;

  if (input.fees.length > limits.feesMax) errors.fees = messages.tooManyFees;
  input.fees.forEach((fee, index) => {
    const nameError = lineNameError(fee.name);
    if (nameError) errors[feeErrorKey(index, 'name')] = nameError;
    const amount = parseNumberInput(fee.amount);
    const percent = fee.type === 'percent';
    if (amount === null) {
      errors[feeErrorKey(index, 'amount')] = percent ? messages.feeRateRequired : messages.feeAmountRequired;
    } else if (!isCentsAmountWithin(amount, percent ? RATE_MAX_BASIS_POINTS : MONEY_MAX_CENTS)) {
      errors[feeErrorKey(index, 'amount')] = percent ? messages.feeRateInvalid : messages.feeAmountInvalid;
    }
  });

  if (input.oneTimeAddOns.length > limits.oneTimeAddOnsMax) errors.oneTimeAddOns = messages.tooManyOneTimeAddOns;
  input.oneTimeAddOns.forEach((line, index) => {
    const nameError = lineNameError(line.name);
    if (nameError) errors[oneTimeAddOnErrorKey(index, 'name')] = nameError;
    const quantity = parseNumberInput(line.quantity);
    if (quantity === null || !isWholeWithin(quantity, 1, limits.oneTimeQuantityMax)) {
      errors[oneTimeAddOnErrorKey(index, 'quantity')] = messages.quantityInvalid;
    }
    const unitPrice = parseNumberInput(line.unitPrice);
    if (unitPrice === null) errors[oneTimeAddOnErrorKey(index, 'unitPrice')] = messages.unitPriceRequired;
    else if (!isCentsAmountWithin(unitPrice, MONEY_MAX_CENTS)) errors[oneTimeAddOnErrorKey(index, 'unitPrice')] = messages.unitPriceInvalid;
  });

  if (context.roomId !== undefined && !hasId(context.roomId)) errors.room = messages.spaceRequired;

  (context.catalog ?? []).forEach((line) => {
    const quantity = wholeCount(line.quantity);
    if (quantity === 0) return;
    const min = Math.max(1, wholeCount(line.minQuantity));
    const max = positiveWhole(line.maxQuantity) ?? limits.catalogQuantityMax;
    if (quantity < min) errors[catalogErrorKey(line.id)] = messages.catalogBelowMinimum(min);
    else if (quantity > max) errors[catalogErrorKey(line.id)] = messages.catalogOutOfRange(textOf(line.name).trim(), min, max);
  });

  const totalCents = context.totalCents;
  if (typeof totalCents === 'number' && Number.isFinite(totalCents)) {
    if (totalCents > TOTAL_MAX_CENTS) errors.total = messages.totalTooLarge;
    const amountPaid = parseNumberInput(context.amountPaid);
    if (amountPaid !== null && toCents(amountPaid) > totalCents) errors.amountPaid = messages.amountPaidOverTotal;
  }

  return errors;
}
