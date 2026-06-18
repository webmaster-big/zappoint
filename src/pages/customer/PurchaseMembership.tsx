import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Crown,
  MapPin,
  Building2,
  Lock,
  AlertCircle,
  ArrowRight,
  Info,
} from 'lucide-react';
import membershipService from '../../services/MembershipService';
import { membershipCache } from '../../services/MembershipCacheService';
import { loadAcceptJS, tokenizeCard } from '../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../services/SettingsService';
import locationService from '../../services/LocationService';
import type { Membership, MembershipPlan, MembershipPlanBenefit } from '../../types/Membership.types';
import Toast from '../../components/ui/Toast';
import StandardButton from '../../components/ui/StandardButton';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { useToast } from '../../hooks/useToast';
import { useThemeColor } from '../../hooks/useThemeColor';
import { formatMembershipPrice } from '../../utils/membershipFormat';


function benefitLabel(b: MembershipPlanBenefit): string {
  const v = Number(b.value);
  const effect =
    b.value_mode === 'percent' ? `${v}% off`
    : b.value_mode === 'fixed' ? `$${v.toFixed(2)} off`
    : b.value_mode === 'free' ? 'Free'
    : b.value_mode === 'count' ? `${v} ${b.benefit_type.includes('guest') ? 'guest' : 'free'} pass${v === 1 ? '' : 'es'}`
    : '';
  const name = b.label || b.benefit_type.replace(/_/g, ' ');
  return effect ? `${name} — ${effect}` : name;
}

function planBullets(plan: MembershipPlan): string[] {
  if (plan.plan_benefits && plan.plan_benefits.length > 0) {
    return plan.plan_benefits.map(benefitLabel);
  }
  return plan.benefits ?? [];
}

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string, prev: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length === 2 && prev.length < value.length && !value.includes('/')) {
    return `${digits}/`;
  }
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function detectCardType(number: string): string | null {
  const raw = number.replace(/\s+/g, '');
  if (/^4/.test(raw)) return 'Visa';
  if (/^5[1-5]/.test(raw) || /^2[2-7]\d{2}/.test(raw)) return 'MC';
  if (/^3[47]/.test(raw)) return 'Amex';
  if (/^6(011|5)/.test(raw)) return 'Discover';
  return null;
}

function CardTypeIcon({ type }: { type: string | null }) {
  if (!type) return null;
  const labels: Record<string, string> = { Visa: 'VISA', MC: 'MC', Amex: 'AMEX', Discover: 'DISC' };
  const colors: Record<string, string> = {
    Visa: 'text-blue-700 bg-blue-50 border-blue-200',
    MC: 'text-red-600 bg-red-50 border-red-200',
    Amex: 'text-sky-600 bg-sky-50 border-sky-200',
    Discover: 'text-orange-600 bg-orange-50 border-orange-200',
  };
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${colors[type] ?? 'text-gray-600 bg-gray-100 border-gray-200'}`}>
      {labels[type] ?? type}
    </span>
  );
}

const PurchaseMembership = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { themeColor } = useThemeColor();
  const [plans, setPlans] = useState<MembershipPlan[]>(
    () => (membershipCache.getPublicPlansSync() ?? []).filter((p) => p.is_active)
  );
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(
    () => (membershipCache.getPublicPlansSync() === null)
  );
  const [homeLocationName, setHomeLocationName] = useState<string>('');
  const { toast, show, showSuccess, showError, clear } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [existingMembership, setExistingMembership] = useState<Membership | null>(null);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');   // MM/YY combined
  const [cvc, setCvc] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [recurringAuthorized, setRecurringAuthorized] = useState(false);

  const [apiLoginId, setApiLoginId] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{
    cardNumber?: string;
    expiry?: string;
    cvc?: string;
  }>({});

  const inputCls = (err?: string) =>
    `w-full border rounded-lg px-3 py-2.5 text-sm transition focus:outline-none focus:ring-2 ${
      err
        ? 'border-red-400 focus:ring-red-200 bg-red-50'
        : `border-gray-200 focus:ring-${themeColor}-200 focus:border-${themeColor}-500 bg-white`
    }`;
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1';

  useEffect(() => {
    (async () => {
      if (plans.length === 0) setLoading(true);
      try {
        const [plansResult, locsResult, myMembership] = await Promise.all([
          membershipCache.getPublicPlans(),
          locationService.getLocations({ is_active: true, per_page: 100 }),
          membershipCache.getMine().catch(() => null),
        ]);
        const activeMembership =
          myMembership && ['active', 'past_due', 'pending'].includes(myMembership.status)
            ? myMembership
            : null;
        setExistingMembership(activeMembership);
        const activePlans = plansResult.filter((pl) => pl.is_active);
        setPlans(activePlans);
        const locs = (locsResult.data ?? []).map((l) => ({ id: l.id, name: l.name }));
        setLocations(locs);
        if (locs.length > 0) setHomeLocationName(locs[0].name);
        const planParam = searchParams.get('plan');
        if (planParam) {
          const pid = parseInt(planParam, 10);
          if (!Number.isNaN(pid) && activePlans.some((pl) => pl.id === pid && pl.is_active)) {
            setSelectedPlanId(pid);
          }
        }
      } catch (e: unknown) {
        showError(e, 'Failed to load plans');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const homeLocationId = useMemo(
    () => locations.find((l) => l.name === homeLocationName)?.id ?? null,
    [locations, homeLocationName],
  );

  useEffect(() => {
    if (!homeLocationId) return;
    (async () => {
      try {
        const res = await getAuthorizeNetPublicKey(homeLocationId);
        if (res?.api_login_id) {
          setApiLoginId(res.api_login_id);
          setClientKey(res.client_key || res.api_login_id);
          await loadAcceptJS((res.environment as 'sandbox' | 'production') || 'sandbox');
        }
      } catch {
      }
    })();
  }, [homeLocationId]);

  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId) || null, [plans, selectedPlanId]);

  const [expMonth, expYear] = useMemo(() => {
    const parts = expiry.split('/');
    const m = (parts[0] ?? '').trim();
    const y = (parts[1] ?? '').trim();
    const fullYear = y.length === 2 ? `20${y}` : y;
    return [m, fullYear];
  }, [expiry]);

  const cardDigits = cardNumber.replace(/\s+/g, '');
  const cardType = detectCardType(cardNumber);

  const isUpgrade = !!existingMembership;
  const currentPlanId = existingMembership?.membership_plan_id ?? existingMembership?.plan?.id ?? null;
  const isCurrentPlan = !!selectedPlanId && selectedPlanId === currentPlanId;

  const currentPrice = existingMembership
    ? parseFloat(String(existingMembership.billing_amount ?? existingMembership.plan?.price ?? 0))
    : 0;
  const selectedPrice = selectedPlan ? parseFloat(String(selectedPlan.price)) : 0;

  // Prorated charge: only the remaining fraction of the current billing term.
  // e.g. upgrading $30→$60 with 15 of 30 days left = ($60-$30)/30*15 = $15 today
  const proratedCharge = (() => {
    if (!isUpgrade || !existingMembership) return selectedPrice;
    const rawDiff = selectedPrice - currentPrice;
    if (rawDiff <= 0) return 0; // downgrade — no charge
    const termEnd = existingMembership.current_term_end ? new Date(existingMembership.current_term_end) : null;
    const termStart = existingMembership.current_term_start ? new Date(existingMembership.current_term_start) : null;
    const billingDays = existingMembership.plan?.billing_cycle === 'annual' ? 365
      : existingMembership.plan?.billing_cycle === 'quarterly' ? 90
      : existingMembership.plan?.billing_cycle === 'one_time' ? 0
      : (existingMembership.plan?.custom_billing_days ?? 30);
    let remainingDays = billingDays;
    if (termEnd) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const msRemaining = termEnd.getTime() - today.getTime();
      remainingDays = Math.max(0, Math.round(msRemaining / 86400000));
    } else if (termStart) {
      // fallback if termEnd is missing
      remainingDays = billingDays;
    }
    return Math.round(rawDiff * remainingDays / billingDays * 100) / 100;
  })();

  const priceDiff = proratedCharge;
  const paymentRequired = !isUpgrade || priceDiff > 0.01;

  const validatePayment = () => {
    if (!paymentRequired) return true;
    const errors: typeof fieldErrors = {};
    if (cardDigits.length < 13) errors.cardNumber = 'Enter a valid card number';
    const parts = expiry.split('/');
    const mm = parseInt(parts[0] ?? '', 10);
    const yy = parseInt(parts[1] ?? '', 10);
    if (!mm || mm < 1 || mm > 12 || isNaN(yy)) {
      errors.expiry = 'Use MM/YY format';
    } else {
      const now = new Date();
      const fullYear = yy < 100 ? 2000 + yy : yy;
      if (
        fullYear < now.getFullYear() ||
        (fullYear === now.getFullYear() && mm < now.getMonth() + 1)
      ) {
        errors.expiry = 'Card has expired';
      }
    }
    if (cvc.length < 3) errors.cvc = 'Enter CVC';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canSubmit =
    !!selectedPlanId &&
    !isCurrentPlan &&
    !!homeLocationId &&
    (isUpgrade || termsAccepted) &&
    (isUpgrade || recurringAuthorized) &&
    (!paymentRequired || (cardDigits.length >= 13 && expiry.includes('/') && cvc.length >= 3));

  const handleSubmit = async () => {
    if (!canSubmit || !selectedPlan) return;
    if (!validatePayment()) return;
    if (paymentRequired && !apiLoginId) {
      show('Payment system not ready. Try again in a moment.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (isUpgrade && existingMembership) {
        let opaqueData: { dataDescriptor: string; dataValue: string } | undefined;
        if (paymentRequired) {
          const opaque = await tokenizeCard(
            { cardNumber: cardDigits, month: expMonth, year: expYear, cardCode: cvc },
            apiLoginId,
            clientKey,
          );
          opaqueData = { dataDescriptor: opaque.dataDescriptor, dataValue: opaque.dataValue };
        }
        await membershipService.upgradePlan(existingMembership.id, selectedPlan.id, opaqueData);
        showSuccess('Membership plan updated!');
      } else {
        const opaque = await tokenizeCard(
          { cardNumber: cardDigits, month: expMonth, year: expYear, cardCode: cvc },
          apiLoginId,
          clientKey,
        );
        await membershipService.purchaseMembership({
          membership_plan_id: selectedPlan.id,
          home_location_id: homeLocationId ?? undefined,
          opaque_data: { dataDescriptor: opaque.dataDescriptor, dataValue: opaque.dataValue },
          terms_accepted: termsAccepted,
          recurring_billing_authorized: recurringAuthorized,
        });
        showSuccess('Membership activated!');
      }
      await membershipCache.invalidate();
      setTimeout(() => navigate('/customer/membership'), 800);
    } catch (e: unknown) {
      showError(e, isUpgrade ? 'Plan change failed' : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <section className={`relative bg-gradient-to-br from-${themeColor}-900 via-${themeColor}-800 to-${themeColor}-700 text-white py-6 md:py-8 overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
              <Crown className="w-3.5 h-3.5" />
            </div>
            <span className={`text-${themeColor}-200/70 text-xs font-semibold uppercase tracking-widest`}>Membership</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className={`w-5 h-5 text-${themeColor}-200`} /> {isUpgrade ? 'Change Membership Plan' : 'Become a Member'}
            <InfoTooltip
              widthClass="w-72"
              iconClassName="text-white/70 hover:text-white"
              content={isUpgrade
                ? 'Select a different plan to switch. If the new plan costs more, you\'ll be charged the difference immediately.'
                : 'Pick a plan, choose your home location and pay securely. Your membership starts immediately and renews at your selected interval until you cancel.'}
            />
          </h1>
          <p className={`text-${themeColor}-200/60 text-sm mt-0.5`}>{isUpgrade ? 'Switch to a different plan at any time.' : 'Unlimited fun, exclusive perks, member-only pricing.'}</p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {isUpgrade && existingMembership && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-800 text-sm">You already have an active membership</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Current plan: <span className="font-medium">{existingMembership.plan?.name ?? `Plan #${existingMembership.membership_plan_id}`}</span>.{' '}
                Select a different plan below to switch. Your current plan card is highlighted.
              </p>
            </div>
            <button
              onClick={() => navigate('/customer/membership')}
              className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 transition font-medium whitespace-nowrap"
            >
              View membership <ArrowRight size={12} />
            </button>
          </div>
        )}
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-6 bg-gray-200 rounded w-1/2" />
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="space-y-1.5">
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                  <div className="h-3 bg-gray-100 rounded w-4/6" />
                </div>
              </div>
            ))
          ) : plans.length === 0 ? (
            <p className="text-gray-500 col-span-3 text-sm">No plans available right now.</p>
          ) : null}
          {plans.map((plan) => {
            const active = selectedPlanId === plan.id;
            const isCurrent = isUpgrade && plan.id === currentPlanId;
            return (
              <button
                key={plan.id}
                onClick={() => !isCurrent && setSelectedPlanId(plan.id)}
                disabled={isCurrent}
                className={`text-left rounded-xl p-4 transition border ${
                  isCurrent
                    ? 'border-gray-300 bg-gray-100 opacity-75 cursor-not-allowed'
                    : active
                    ? `border-${themeColor}-500 ring-2 ring-${themeColor}-200 bg-${themeColor}-50`
                    : `border-gray-200 hover:border-${themeColor}-300 bg-white hover:shadow-sm`
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  {isCurrent
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 border border-gray-300 whitespace-nowrap">Current Plan</span>
                    : active && <CheckCircle2 className={`w-4 h-4 text-${themeColor}-600 flex-shrink-0 mt-0.5`} />}
                </div>
                <p className="text-xl font-bold text-gray-900 mt-1">
                  {formatMembershipPrice(plan.price)}
                  <span className="text-xs font-normal text-gray-500">/{plan.billing_interval.replace('_', ' ')}</span>
                </p>
                {plan.description && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{plan.description}</p>}
                {plan.location_access_label && (
                  <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
                    <Building2 size={10} className="flex-shrink-0" /> {plan.location_access_label}
                  </p>
                )}
                {(() => {
                  const bullets = planBullets(plan);
                  return bullets.length > 0 ? (
                    <ul className="mt-2 space-y-0.5">
                      {bullets.slice(0, 3).map((b, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                          <CheckCircle2 size={11} className="text-green-500 mt-0.5 flex-shrink-0" /> {b}
                        </li>
                      ))}
                      {bullets.length > 3 && (
                        <li className="text-xs text-gray-400 pl-4">+{bullets.length - 3} more</li>
                      )}
                    </ul>
                  ) : null;
                })()}
              </button>
            );
          })}
        </div>

        {selectedPlan && (
          <div className="grid md:grid-cols-5 gap-4 items-start">

            <div className="md:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">

              <div className="px-5 pt-5 pb-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <MapPin className={`w-4 h-4 text-${themeColor}-600`} /> Home Location
                  <InfoTooltip content="Select the location you'll visit most. Used for single-location plan access." size={13} />
                </h2>
                <select
                  value={homeLocationName}
                  onChange={(e) => setHomeLocationName(e.target.value)}
                  disabled={locations.length === 0}
                  className={`w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-${themeColor}-200 focus:border-${themeColor}-500 disabled:opacity-50`}
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
                {selectedPlan.valid_locations && selectedPlan.valid_locations.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedPlan.valid_locations.slice(0, 8).map((loc) => (
                      <span key={loc} className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 bg-gray-50 border border-gray-200 rounded text-gray-600">
                        <MapPin size={8} className={`text-${themeColor}-400`} /> {loc}
                      </span>
                    ))}
                    {selectedPlan.valid_locations.length > 8 && (
                      <span className="text-[10px] text-gray-400 px-1.5 py-0.5">+{selectedPlan.valid_locations.length - 8} more</span>
                    )}
                  </div>
                )}
              </div>

              {paymentRequired ? (
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
                  <CreditCard className={`w-4 h-4 text-${themeColor}-600`} />
                  {isUpgrade ? 'Card for upgrade charge' : 'Payment'}
                  <InfoTooltip content="Your card is securely tokenized via Authorize.Net — never stored on our servers." size={13} />
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Card number</label>
                    <div className="relative">
                      <input
                        value={cardNumber}
                        onChange={(e) => {
                          setCardNumber(formatCardNumber(e.target.value));
                          if (fieldErrors.cardNumber) setFieldErrors((p) => ({ ...p, cardNumber: undefined }));
                        }}
                        onBlur={() => {
                          if (cardDigits.length > 0 && cardDigits.length < 13)
                            setFieldErrors((p) => ({ ...p, cardNumber: 'Enter a valid card number' }));
                        }}
                        placeholder="1234 5678 9012 3456"
                        className={`${inputCls(fieldErrors.cardNumber)} pr-16`}
                        autoComplete="cc-number"
                        inputMode="numeric"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2">
                        <CardTypeIcon type={cardType} />
                      </span>
                    </div>
                    {fieldErrors.cardNumber && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle size={11} /> {fieldErrors.cardNumber}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Expiry</label>
                      <input
                        value={expiry}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (raw.length < expiry.length) { setExpiry(raw); return; }
                          setExpiry(formatExpiry(raw, expiry));
                          if (fieldErrors.expiry) setFieldErrors((p) => ({ ...p, expiry: undefined }));
                        }}
                        placeholder="MM/YY"
                        maxLength={5}
                        className={inputCls(fieldErrors.expiry)}
                        autoComplete="cc-exp"
                        inputMode="numeric"
                      />
                      {fieldErrors.expiry && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle size={11} /> {fieldErrors.expiry}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>
                        CVC <InfoTooltip content="3-digit code on back of card. Amex: 4 digits on front." size={12} />
                      </label>
                      <input
                        value={cvc}
                        onChange={(e) => {
                          setCvc(e.target.value.replace(/\D/g, '').slice(0, 4));
                          if (fieldErrors.cvc) setFieldErrors((p) => ({ ...p, cvc: undefined }));
                        }}
                        placeholder="CVC"
                        maxLength={4}
                        className={inputCls(fieldErrors.cvc)}
                        autoComplete="cc-csc"
                        inputMode="numeric"
                      />
                      {fieldErrors.cvc && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                          <AlertCircle size={11} /> {fieldErrors.cvc}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>
                      Name on card <span className="font-normal text-gray-400">(optional)</span>
                    </label>
                    <input
                      value={nameOnCard}
                      onChange={(e) => setNameOnCard(e.target.value)}
                      placeholder="As it appears on your card"
                      className={inputCls()}
                      autoComplete="cc-name"
                    />
                  </div>

                  <p className="flex items-center gap-1 text-[11px] text-gray-400">
                    <ShieldCheck size={12} className="text-green-500" /> Tokenized via Authorize.Net · never stored on our servers
                  </p>
                </div>
              </div>
              ) : (
              <div className="px-5 py-4 border-b border-gray-100 bg-green-50/50">
                <div className="flex items-center gap-2 text-green-700 text-sm">
                  <ShieldCheck size={16} className="text-green-600 flex-shrink-0" />
                  <span>No payment required — this plan costs the same or less than your current plan.</span>
                </div>
              </div>
              )}

              {!isUpgrade && (
              <div className="px-5 py-4 space-y-3 bg-gray-50/50">
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className={`mt-0.5 rounded text-${themeColor}-600 focus:ring-${themeColor}-400 flex-shrink-0`}
                  />
                  <span className="text-xs text-gray-600 group-hover:text-gray-800 transition leading-relaxed">
                    I have read and agree to the <span className={`font-medium text-${themeColor}-700`}>Membership Terms &amp; Conditions</span>, including cancellation, refund, and usage policies.
                  </span>
                </label>
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={recurringAuthorized}
                    onChange={(e) => setRecurringAuthorized(e.target.checked)}
                    className={`mt-0.5 rounded text-${themeColor}-600 focus:ring-${themeColor}-400 flex-shrink-0`}
                  />
                  <span className="text-xs text-gray-600 group-hover:text-gray-800 transition leading-relaxed">
                    I authorize automatic recurring charges of{' '}
                    <span className="font-semibold text-gray-800">{formatMembershipPrice(selectedPlan.price)}/{selectedPlan.billing_interval.replace('_', ' ')}</span>{' '}
                    until I cancel. My membership renews automatically.
                  </span>
                </label>
              </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Order summary</h3>

                <div className={`rounded-lg bg-${themeColor}-50 border border-${themeColor}-100 p-3 mb-4`}>
                  <p className="text-sm font-semibold text-gray-900">{selectedPlan.name}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5">
                    {formatMembershipPrice(selectedPlan.price)}
                    <span className="text-xs font-normal text-gray-500">/{selectedPlan.billing_interval.replace('_', ' ')}</span>
                  </p>
                  {selectedPlan.location_access_label && (
                    <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                      <Building2 size={10} /> {selectedPlan.location_access_label}
                    </p>
                  )}
                </div>

                <div className="text-xs text-gray-500 space-y-1.5 mb-4 border-t border-gray-100 pt-3">
                  {isUpgrade ? (
                    <>
                      <div className="flex justify-between">
                        <span>
                          Due today
                          {priceDiff > 0.01 ? ' (prorated upgrade)' : ''}
                        </span>
                        <span className="font-semibold text-gray-800">
                          {priceDiff > 0.01 ? formatMembershipPrice(priceDiff) : '$0.00'}
                        </span>
                      </div>
                      {priceDiff > 0.01 && existingMembership?.current_term_end && (
                        <div className="flex justify-between text-gray-400">
                          <span>Covers remaining term until</span>
                          <span>{new Date(existingMembership.current_term_end).toLocaleDateString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>New recurring amount</span>
                        <span className="text-gray-700">
                          {formatMembershipPrice(selectedPlan.price)}/{selectedPlan.billing_interval.replace('_', ' ')}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Due today</span>
                        <span className="font-semibold text-gray-800">{formatMembershipPrice(selectedPlan.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Renews</span>
                        <span className="text-gray-700 capitalize">{selectedPlan.billing_interval.replace('_', ' ')}</span>
                      </div>
                    </>
                  )}
                  {!isUpgrade && (
                  <div className="flex justify-between">
                    <span>Home location</span>
                    <span className="text-gray-700">{homeLocationName}</span>
                  </div>
                  )}
                </div>

                {isCurrentPlan && (
                  <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertCircle size={12} /> You already have this plan.
                  </div>
                )}

                <StandardButton
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                  className="w-full"
                >
                  {submitting ? 'Processing…' : isUpgrade ? (
                    <span className="flex items-center justify-center gap-2">
                      <Lock size={14} />
                      {priceDiff > 0.01 ? `Switch Plan · Pay ${formatMembershipPrice(priceDiff)} today` : 'Switch Plan (no charge)'}
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Lock size={14} /> Activate · {formatMembershipPrice(selectedPlan.price)}
                    </span>
                  )}
                </StandardButton>

                <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck size={11} className="text-gray-400" /> Secure checkout · Powered by Authorize.Net
                </p>
              </div>

              {(() => {
                const bullets = planBullets(selectedPlan);
                return bullets.length > 0 ? (
                  <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Included benefits</p>
                    <ul className="space-y-1.5">
                      {bullets.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle2 size={12} className="text-green-500 mt-0.5 flex-shrink-0" /> {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PurchaseMembership;

