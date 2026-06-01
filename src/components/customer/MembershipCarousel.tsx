import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { membershipCache } from '../../services/MembershipCacheService';
import type { MembershipPlan, MembershipPlanBenefit } from '../../types/Membership.types';
import { formatMembershipPrice } from '../../utils/membershipFormat';
import { isCustomerAuthenticated } from '../../utils/auth';

// Set to true once membership feature testing is complete
const CAROUSEL_ENABLED = false;

const CARD_GRADIENTS = [
  'linear-gradient(145deg, #8b5cf6 0%, #6d28d9 100%)',
  'linear-gradient(145deg, #6366f1 0%, #4338ca 100%)',
  'linear-gradient(145deg, #312e81 0%, #1e1b4b 100%)',
] as const;

const DECK_OFFSET_X = 16;
const DECK_OFFSET_Y = 14;
const DECK_SCALE    = 0.045;

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

const usageLabel = (p: MembershipPlan) => {
  if (p.unlimited_visits || p.usage_type === 'unlimited') return 'Unlimited visits';
  if (p.usage_type === 'punch_card') return `${p.punch_card_total ?? 0}-visit punch card`;
  if (p.usage_type === 'limited_visits') return `${p.included_visits_per_term ?? 0} visits / term`;
  return 'Member access';
};

const accessLabel = (p: MembershipPlan) => {
  if (p.location_access_mode === 'all') return 'All locations';
  if (p.location_access_mode === 'multi') return 'Multiple locations';
  return p.location?.name ?? 'Home location';
};

const MembershipCarousel = () => {
  const navigate = useNavigate();
  const [plans,   setPlans]   = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let cancelled = false;
    membershipCache
      .getPublicPlans()
      .then((list) => { if (!cancelled) setPlans(list); })
      .catch(() =>    { if (!cancelled) setPlans([]); })
      .finally(() =>  { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => plans.filter((p) => p.is_active), [plans]);

  useEffect(() => {
    if (CAROUSEL_ENABLED && !loading && visible.length > 0) setOpen(true);
  }, [loading, visible.length]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  setCurrent((i) => (i - 1 + visible.length) % visible.length);
      if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % visible.length);
      if (e.key === 'Escape')     setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, visible.length]);

  const goPurchase = (planId: number) => {
    const target = `/customer/membership/purchase?plan=${planId}`;
    setOpen(false);
    if (isCustomerAuthenticated()) navigate(target);
    else navigate(`/customer/register?next=${encodeURIComponent(target)}`);
  };

  if (!loading && visible.length === 0) return null;
  if (!CAROUSEL_ENABLED) return null;

  const prev = () => setCurrent((i) => (i - 1 + visible.length) % visible.length);
  const next = () => setCurrent((i) => (i + 1) % visible.length);

  const getDeckDepth = (planIdx: number): number => {
    const diff = ((current - planIdx) % visible.length + visible.length) % visible.length;
    return diff <= 2 ? diff : 99;
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/80 backdrop-blur flex items-center justify-center text-gray-600 hover:bg-white transition shadow-sm z-50"
          >
            <X size={16} />
          </button>

          {visible.length > 1 && (
            <p className="mb-4 text-sm font-medium text-gray-500 tracking-wide">
              {current + 1} / {visible.length}
            </p>
          )}

          <div className="flex items-center gap-2 sm:gap-4">
            {visible.length > 1 && (
              <button
                onClick={prev}
                aria-label="Previous plan"
                className="flex-shrink-0 w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center text-gray-600 hover:bg-white transition"
              >
                <ChevronLeft size={18} />
              </button>
            )}

            <div
              className="relative flex-shrink-0"
              style={{ paddingTop: DECK_OFFSET_Y * 2, paddingLeft: DECK_OFFSET_X * 2 }}
            >
              <div className="relative" style={{ width: 'min(320px, 72vw)' }}>

                {visible.map((plan, idx) => {
                  const depth = getDeckDepth(idx);
                  if (depth === 0 || depth > 2) return null;
                  const bg = CARD_GRADIENTS[idx % CARD_GRADIENTS.length];
                  return (
                    <div
                      key={plan.id}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: bg,
                        borderRadius: '1.5rem',
                        transform: `translateX(${-depth * DECK_OFFSET_X}px) translateY(${-depth * DECK_OFFSET_Y}px) scale(${1 - depth * DECK_SCALE})`,
                        transformOrigin: 'center center',
                        zIndex: 30 - depth * 10,
                        opacity: depth === 1 ? 0.75 : 0.55,
                        transition: 'transform 0.38s ease, opacity 0.38s ease',
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}

                {(() => {
                  const plan = visible[current];
                  if (!plan) return null;
                  const bg = CARD_GRADIENTS[current % CARD_GRADIENTS.length];
                  const planBenefitBullets =
                    plan.plan_benefits && plan.plan_benefits.length > 0
                      ? plan.plan_benefits.slice(0, 3).map(benefitLabel)
                      : (plan.benefits?.slice(0, 3) ?? []);
                  const perks: string[] = [
                    usageLabel(plan),
                    accessLabel(plan),
                    ...planBenefitBullets,
                  ];
                  return (
                    <>
                      <style>{`@keyframes cardSlideIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
                      <div
                        key={plan.id}
                        style={{ position: 'relative', zIndex: 30, background: bg, animation: 'cardSlideIn 0.3s ease-out' }}
                        className="rounded-3xl flex flex-col text-white shadow-2xl"
                      >
                      <div className="px-6 pt-7 pb-5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/50 mb-1.5">
                          Membership
                        </p>
                        <h3 className="text-xl font-bold leading-tight">{plan.name}</h3>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-[2rem] font-black leading-none tracking-tight">
                            {formatMembershipPrice(plan.price)}
                          </span>
                          <span className="text-sm text-white/55 ml-1">
                            / {plan.billing_interval.replace('_', ' ')}
                          </span>
                        </div>
                        {plan.trial_days != null && plan.trial_days > 0 && (
                          <p className="mt-1.5 text-xs text-white/60">
                            {plan.trial_days}-day free trial included
                          </p>
                        )}
                        {plan.discount_percent != null && Number(plan.discount_percent) > 0 && (
                          <p className="mt-0.5 text-xs text-white/60">
                            {Number(plan.discount_percent)}% off all attractions
                          </p>
                        )}
                      </div>

                      <div className="mx-6 h-px bg-white/15" />

                      <div className="px-6 py-4">
                        {plan.description && (
                          <p className="text-xs text-white/55 mb-3 leading-relaxed line-clamp-2">
                            {plan.description}
                          </p>
                        )}
                        <ul className="space-y-2">
                          {perks.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-white/85">
                              <span className="mt-[3px] text-white/40 text-xs leading-none select-none">—</span>
                              <span className="leading-snug">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="px-6 pb-6">
                        <button
                          onClick={() => goPurchase(plan.id)}
                          className="w-full py-3 rounded-2xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold transition"
                        >
                          {isCustomerAuthenticated() ? 'Join Now' : 'Get Started'}
                        </button>
                      </div>
                    </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {visible.length > 1 && (
              <button
                onClick={next}
                aria-label="Next plan"
                className="flex-shrink-0 w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center text-gray-600 hover:bg-white transition"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </div>

          {visible.length > 1 && (
            <div className="flex gap-2 mt-5">
              {visible.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  aria-label={`Go to plan ${i + 1}`}
                  className={`rounded-full transition-all duration-200 ${
                    i === current
                      ? 'w-5 h-2 bg-violet-500'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default MembershipCarousel;
