import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Tag } from 'lucide-react';
import promoService, { type Promo } from '../../../services/PromoService';
import { dateKey, michiganToday } from '../../../utils/timeFormat';
import type { EmailPromoSummary } from '../../../types/EmailNotification.types';

interface LocationOption {
  id: number;
  name: string;
}

interface PromoCodePickerProps {
  value: number | null;
  onChange: (promoId: number | null) => void;
  locationId?: number | null;
  locations?: LocationOption[];
  summary?: EmailPromoSummary | null;
  disabled?: boolean;
}

const promoOfferLabel = (promo: Pick<Promo, 'type' | 'value'>): string => {
  const value = Number(promo.value);
  const amount = Number.isInteger(value) ? String(value) : value.toFixed(2);

  return promo.type === 'percentage' ? `${amount}% off` : `$${amount} off`;
};

const formatDay = (value?: string | null): string => {
  if (!value) return '';
  const day = value.split('T')[0];
  const [year, month, date] = day.split('-').map(Number);

  return new Date(year, month - 1, date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const promoTargets = (promo: Promo): number[] =>
  Array.isArray(promo.location_ids) ? promo.location_ids.map((id) => Number(id)) : [];

const isItemLimited = (promo: Promo): boolean =>
  [promo.package_ids, promo.attraction_ids, promo.event_ids].some((ids) => Array.isArray(ids) && ids.length > 0);

const PROMO_QUERY = { status: 'all', per_page: 500, shared_only: true } as const;

const problemsFor = (promo: Promo, locationId: number | null | undefined, locations: LocationOption[]): string[] => {
  const today = dateKey(michiganToday());
  const problems: string[] = [];
  const start = promo.start_date?.split('T')[0];
  const end = promo.end_date?.split('T')[0];
  const targets = promoTargets(promo);

  if (promo.status !== 'active') problems.push(`This code is ${promo.status}, so the email leaves it out until it is active again.`);
  if (start && start > today) problems.push(`This code starts on ${formatDay(start)}. Emails sent before then leave it out.`);
  if (end && end < today) problems.push(`This code expired on ${formatDay(end)}, so the email leaves it out.`);
  if (promo.usage_limit_total && promo.current_usage >= promo.usage_limit_total) {
    problems.push('This code has been used the maximum number of times, so the email leaves it out.');
  }
  if (targets.length > 0 && locationId && !targets.includes(locationId)) {
    const name = locations.find((location) => location.id === locationId)?.name ?? 'this email’s location';
    problems.push(`This code does not work at ${name}, so the email leaves it out there.`);
  }

  return problems;
};

const PromoCodePicker = ({ value, onChange, locationId = null, locations = [], summary = null, disabled = false }: PromoCodePickerProps) => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchPromos = () =>
      promoService
        .getPromos(PROMO_QUERY)
        .catch(() => new Promise<Awaited<ReturnType<typeof promoService.getPromos>>>((resolve, reject) => {
          setTimeout(() => promoService.getPromos(PROMO_QUERY).then(resolve, reject), 1500);
        }));

    fetchPromos()
      .then((response) => {
        if (!alive) return;
        const list = (response.data?.promos ?? []).filter((promo) => !promo.batch_id && promo.code_mode !== 'unique' && !promo.deleted);
        setPromos(list);
      })
      .catch(() => {
        if (alive) setLoadError('Promo codes could not be loaded. Reload the page to try again.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selected = useMemo(() => promos.find((promo) => promo.id === value) ?? null, [promos, value]);
  const problems = selected ? problemsFor(selected, locationId, locations) : summary?.problem ? [summary.problem] : [];
  const targets = selected ? promoTargets(selected) : [];
  const targetNames = targets
    .map((id) => locations.find((location) => location.id === id)?.name)
    .filter((name): name is string => Boolean(name));
  const missingSelection = value !== null && !loading && !selected;
  const savedTerms = summary && selected && summary.id === selected.id ? summary.terms ?? '' : '';

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="visit-promo" className="block text-sm font-medium text-gray-700 mb-1">
          Return-visit promo code
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Guests see this code as a thank-you for their next visit. Change it here whenever you like; each email uses the code chosen when it is sent.
        </p>
        <select
          id="visit-promo"
          value={value ?? ''}
          disabled={disabled || loading}
          onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100"
        >
          <option value="">{loading ? 'Loading promo codes…' : 'No promo code'}</option>
          {missingSelection && <option value={value ?? ''}>{summary?.code ?? `Promo #${value}`} (not in the list)</option>}
          {promos.map((promo) => (
            <option key={promo.id} value={promo.id}>
              {promo.code} · {promoOfferLabel(promo)}
              {promo.status !== 'active' ? ` · ${promo.status}` : ''}
              {promo.end_date ? ` · ends ${formatDay(promo.end_date)}` : ''}
            </option>
          ))}
        </select>
        {loadError && <p className="text-xs text-red-600 mt-1">{loadError}</p>}
      </div>

      {selected && (
        <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
          <Tag className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-900 space-y-0.5">
            <p>
              <span className="font-mono font-semibold tracking-wide">{selected.code}</span> · {promoOfferLabel(selected)}
              {selected.name ? ` · ${selected.name}` : ''}
            </p>
            <p className="text-xs text-amber-800">
              {selected.end_date ? `Valid until ${formatDay(selected.end_date)}. ` : 'No end date. '}
              {targets.length === 0
                ? 'Works at every location.'
                : `Works only at ${targetNames.length > 0 ? targetNames.join(', ') : `${targets.length} location(s)`}.`}
            </p>
            {isItemLimited(selected) && (
              <p className="text-xs text-amber-800">
                {savedTerms || 'Works only on some packages, attractions or events.'} The email tells guests where the code works.
              </p>
            )}
          </div>
        </div>
      )}

      {selected && targets.length > 0 && !locationId && (
        <p className="text-xs text-gray-600">
          This email goes to guests of every location, but the code only works at some of them. Guests of the other locations get the email without a code.
        </p>
      )}

      {problems.map((problem) => (
        <p key={problem} className="flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          {problem}
        </p>
      ))}

      <p className="text-xs text-gray-500">
        Codes from a bulk batch are not listed because each works only once. Create or edit codes under{' '}
        <Link to="/packages/promos" className="underline">
          Promo Codes
        </Link>
        .
      </p>
    </div>
  );
};

export default PromoCodePicker;
