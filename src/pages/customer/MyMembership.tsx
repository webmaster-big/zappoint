import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Calendar,
  MapPin,
  CreditCard,
  Pause,
  XCircle,
  RefreshCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Tag,
  Building2,
  ArrowUpCircle,
  Ticket,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import membershipService from '../../services/MembershipService';
import { membershipCache } from '../../services/MembershipCacheService';
import type { Membership, MembershipBenefitRedemption } from '../../types/Membership.types';
import Toast from '../../components/ui/Toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StandardButton from '../../components/ui/StandardButton';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { useToast } from '../../hooks/useToast';
import { useThemeColor } from '../../hooks/useThemeColor';
import MembershipStatusBadge from '../../components/membership/MembershipStatusBadge';
import {
  formatMembershipDate as fmt,
  formatMembershipPrice,
} from '../../utils/membershipFormat';

const MyMembership = () => {
  const navigate = useNavigate();
  const { themeColor } = useThemeColor();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const { toast, showSuccess, showError, show, clear } = useToast();

  const cardCls = 'bg-white rounded-xl shadow-sm border border-gray-100 p-6';

  const describeRedemption = (r: MembershipBenefitRedemption): string => {
    const v = Number(r.value_applied);
    switch (r.value_mode) {
      case 'percent': return `${v}% off`;
      case 'fixed':   return `$${v.toFixed(2)} off`;
      case 'free':    return 'Free (100% off)';
      case 'count':   return 'Pass used';
      case 'flag':    return 'Access granted';
      default:        return '';
    }
  };

  const load = async (forceRefresh = false) => {
    try {
      const m = await membershipCache.getMine(forceRefresh);
      setMembership(m);
    } catch (e: unknown) {
      showError(e, 'Failed to load membership');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const off = membershipCache.onUpdate(async (detail) => {
      if (detail.key === 'mine' || detail.key === 'all') {
        try {
          const m = await membershipCache.getMine();
          setMembership(m);
        } catch { /* ignore */ }
      }
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFreeze = async () => {
    if (!membership) return;
    const until = window.prompt('Freeze until (YYYY-MM-DD):');
    if (!until) return;
    setActing('freeze');
    try {
      const updated = await membershipService.freezeMembership(membership.id, until, 'Requested by customer');
      setMembership(updated);
      await membershipCache.updateMembershipInCache(updated);
      showSuccess('Freeze request submitted');
    } catch (e: unknown) {
      showError(e, 'Freeze failed');
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async () => {
    if (!membership) return;
    const mode = membership.plan?.cancellation_mode === 'immediate' ? 'immediate' : 'end_of_term';
    if (membership.plan?.cancellation_mode === 'staff_only') {
      show('Please contact staff to cancel your membership.', 'info');
      return;
    }
    if (!window.confirm(`Cancel membership (${mode.replace('_', ' ')})?`)) return;
    setActing('cancel');
    try {
      const updated = await membershipService.cancelMembership(membership.id, mode, 'Customer-initiated');
      setMembership(updated);
      await membershipCache.updateMembershipInCache(updated);
      showSuccess('Cancellation processed');
    } catch (e: unknown) {
      showError(e, 'Cancel failed');
    } finally {
      setActing(null);
    }
  };

  const handleRetry = async () => {
    if (!membership) return;
    setActing('retry');
    try {
      await membershipService.retryPayment(membership.id);
      showSuccess('Payment retry attempted');
      await load(true);
    } catch (e: unknown) {
      showError(e, 'Retry failed');
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen size="medium" message="Loading your membership…" />;
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-gray-50/80">
        <section className={`relative bg-gradient-to-br from-${themeColor}-900 via-${themeColor}-800 to-${themeColor}-700 text-white py-6 md:py-8 overflow-hidden`}>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                <Crown className="w-3.5 h-3.5" />
              </div>
              <span className={`text-${themeColor}-200/70 text-xs font-semibold uppercase tracking-widest`}>Membership</span>
            </div>
            <h1 className="text-xl font-bold text-white">My Membership</h1>
            <p className={`text-${themeColor}-200/60 text-sm mt-0.5`}>Become a member to unlock unlimited fun</p>
          </div>
        </section>
        <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <Crown className="w-10 h-10 text-violet-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Membership Yet</h2>
          <p className="text-sm text-gray-500 mb-6">
            Unlock unlimited access, member-only pricing, and exclusive perks at every ZapZone location.
          </p>
          <button
            onClick={() => navigate('/customer/membership/purchase')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition"
          >
            <Sparkles size={14} />
            Browse Membership Plans
          </button>
        </div>
      </div>
    );
  }

  const plan = membership.plan;
  const usageLine = (() => {
    if (!plan) return '';
    if (plan.unlimited_visits || plan.usage_type === 'unlimited') return 'Unlimited visits';
    if (plan.usage_type === 'punch_card') {
      return `${membership.visits_remaining ?? plan.punch_card_total ?? 0} visits remaining`;
    }
    if (plan.usage_type === 'limited_visits') {
      const used = membership.visits_used_this_term ?? 0;
      const total = plan.included_visits_per_term ?? 0;
      return `${used} / ${total} visits used this term`;
    }
    return '';
  })();

  const totalSaved = (membership.benefit_redemptions ?? [])
    .filter((r) => ['percent', 'fixed', 'free'].includes(r.value_mode))
    .reduce((sum, r) => sum + Number(r.value_applied || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50/80">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <section className={`relative bg-gradient-to-br from-${themeColor}-900 via-${themeColor}-800 to-${themeColor}-700 text-white py-6 md:py-8 overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                  <Crown className="w-3.5 h-3.5" />
                </div>
                <span className={`text-${themeColor}-200/70 text-xs font-semibold uppercase tracking-widest`}>Membership</span>
              </div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                {plan?.name || 'My Membership'}
                <InfoTooltip
                  widthClass="w-72"
                  iconClassName="text-white/70 hover:text-white"
                  content="Your active membership. Use the QR code below to check in at any approved location. Manage billing, freeze or cancel from this page."
                />
              </h1>
              <p className={`text-${themeColor}-200/60 text-sm mt-0.5`}>{plan?.description || 'Manage your membership and view your QR check-in code.'}</p>
            </div>
            <MembershipStatusBadge status={membership.status} size="md" />
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {membership.status === 'past_due' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-semibold text-amber-800">Payment issue</p>
              <p className="text-sm text-amber-700">
                Your last payment failed. Grace ends {fmt(membership.grace_period_ends_at)}. Update your payment method or retry the charge.
              </p>
            </div>
            <StandardButton variant="primary" size="sm" loading={acting === 'retry'} onClick={handleRetry}>
              Retry payment
            </StandardButton>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          <div className={`${cardCls} flex flex-col items-center text-center`}>
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 inline-flex items-center gap-1">
              Check-In QR Code
              <InfoTooltip
                widthClass="w-64"
                content="Show this code at the front desk on every visit. Staff will scan it to verify your membership and log your check-in."
              />
            </p>
            <div className="bg-white p-3 border border-gray-200 rounded-xl">
              <QRCodeSVG value={membership.qr_token} size={180} level="M" />
            </div>
            <p className="font-mono text-xs text-gray-500 mt-3 break-all">{membership.qr_token}</p>
            <p className="text-xs text-gray-500 mt-2">Show this at the front desk on every visit.</p>
          </div>

          <div className={`${cardCls} md:col-span-2 space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><Calendar size={12} /> Started <InfoTooltip content="The date you first activated this membership." size={11} /></p>
                <p className="font-medium text-gray-900">{fmt(membership.started_at)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><RefreshCcw size={12} /> Renews <InfoTooltip content="End of your current paid term. Your next recurring charge fires on this date." size={11} /></p>
                <p className="font-medium text-gray-900">{fmt(membership.current_term_end)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><CreditCard size={12} /> Billing <InfoTooltip content="How often you are charged for this membership." size={11} /></p>
                <p className="font-medium text-gray-900 capitalize">
                  {formatMembershipPrice(membership.billing_amount ?? plan?.price ?? 0)}
                  {' / '}{plan?.billing_interval?.replace('_', ' ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><Tag size={12} /> Plan Tier <InfoTooltip content="The tier level of your current membership plan." size={11} /></p>
                <p className="font-medium text-gray-900 capitalize">{plan?.tier || '—'}</p>
              </div>
            </div>

            <div className="border border-gray-100 rounded-xl p-4 bg-gray-50">
              <p className="text-xs uppercase text-gray-500 mb-2 flex items-center gap-1">
                <Building2 size={12} />
                {membership.location_access_label || 'Valid Locations'}
                <InfoTooltip
                  content="These are all the locations where you can use your membership. Show your QR code at the front desk at any of these locations."
                  size={11}
                />
              </p>
              {membership.valid_locations && membership.valid_locations.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {membership.valid_locations.map((loc) => (
                    <span key={loc} className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-2 py-1">
                      <MapPin size={10} className={`text-${themeColor}-500 flex-shrink-0`} />
                      {loc}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <MapPin size={14} />
                  {membership.home_location?.name || 'Home location only — contact staff for details.'}
                </p>
              )}
            </div>

            <div>
              <p className="text-xs uppercase text-gray-500 mb-1 flex items-center gap-1"><CheckCircle2 size={12} /> Usage <InfoTooltip content="How many visits you have left in the current term, or punch-card total for fixed-visit plans." size={11} /></p>
              <p className="font-medium text-gray-900">{usageLine}</p>
            </div>

            {membership.last_visit_at && (
              <div>
                <p className="text-xs uppercase text-gray-500 flex items-center gap-1"><Clock size={12} /> Last Visit</p>
                <p className="font-medium text-gray-900">{fmt(membership.last_visit_at)}</p>
              </div>
            )}

            {(() => {
              const hasPlanBenefits = plan?.plan_benefits && plan.plan_benefits.length > 0;
              const inheritedBenefits = plan?.inherits_plan?.plan_benefits ?? [];
              const ownBenefits = hasPlanBenefits ? plan!.plan_benefits! : [];
              const structuredItems = [
                ...inheritedBenefits.filter((b) => !ownBenefits.some((o) => o.id === b.id)),
                ...ownBenefits,
              ];
              // Free-text extras: only shown when no structured benefits are defined, for backward compat
              const textItems = structuredItems.length > 0 ? [] : (plan?.benefits ?? []);
              if (structuredItems.length === 0 && textItems.length === 0) return null;
              return (
                <div>
                  <p className="text-xs uppercase text-gray-500 mb-2 flex items-center gap-1"><Sparkles size={12} /> Member Benefits</p>
                  <ul className="text-sm space-y-1">
                    {structuredItems.map((b) => {
                      const v = Number(b.value);
                      const effect =
                        b.value_mode === 'percent' ? `${v}% off`
                        : b.value_mode === 'fixed' ? `$${v.toFixed(2)} off`
                        : b.value_mode === 'free' ? 'Free'
                        : b.value_mode === 'count'
                          ? `${v} ${b.benefit_type.includes('guest') ? 'guest' : 'free'} pass${v === 1 ? '' : 'es'} / ${
                              b.period === 'per_day' ? 'per day' : b.period === 'per_term' ? 'per term' : 'lifetime'
                            }`
                        : b.value_mode === 'flag' ? 'Included'
                        : '';
                      return (
                        <li key={b.id} className="flex items-start gap-2 text-gray-700">
                          <CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                          <span>
                            {b.label || b.benefit_type.replace(/_/g, ' ')}
                            {effect && <span className="text-green-700 font-medium"> — {effect}</span>}
                          </span>
                        </li>
                      );
                    })}
                    {textItems.map((b, i) => (
                      <li key={`txt-${i}`} className="flex items-start gap-2 text-gray-700">
                        <CheckCircle2 size={14} className="text-green-600 mt-0.5 flex-shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {totalSaved > 0 && (
              <div className={`rounded-xl border border-${themeColor}-100 bg-${themeColor}-50 p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className={`text-${themeColor}-600`} />
                  <span className="text-sm font-medium text-gray-700">Total saved with your membership</span>
                </div>
                <span className={`text-lg font-bold text-${themeColor}-700`}>${totalSaved.toFixed(2)}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
              <div className="inline-flex items-center gap-1">
                <StandardButton
                  variant="secondary"
                  size="sm"
                  icon={CreditCard}
                  onClick={() => navigate('/customer/membership/update-payment')}
                >
                  Update payment method
                </StandardButton>
                <InfoTooltip content="Change the saved card used for future renewals." />
              </div>
              <div className="inline-flex items-center gap-1">
                <StandardButton
                  variant="secondary"
                  size="sm"
                  icon={ArrowUpCircle}
                  onClick={() => navigate('/customer/membership/purchase')}
                >
                  Change plan
                </StandardButton>
                <InfoTooltip content="Switch to a different membership plan. Upgrades charge the price difference immediately." />
              </div>
              {membership.status === 'active' && (
                <div className="inline-flex items-center gap-1">
                  <StandardButton
                    variant="secondary"
                    size="sm"
                    icon={Pause}
                    loading={acting === 'freeze'}
                    onClick={handleFreeze}
                  >
                    Request freeze
                  </StandardButton>
                  <InfoTooltip content="Temporarily pause billing and access. You'll be asked for a return date." />
                </div>
              )}
              {membership.status !== 'canceled' && membership.status !== 'expired' && (
                <div className="inline-flex items-center gap-1">
                  <StandardButton
                    variant="danger"
                    size="sm"
                    icon={XCircle}
                    loading={acting === 'cancel'}
                    onClick={handleCancel}
                  >
                    Cancel membership
                  </StandardButton>
                  <InfoTooltip content="Stop auto-renewal. Depending on your plan, access ends immediately or at the end of the current term." />
                </div>
              )}
            </div>
          </div>
        </div>

        {membership.membership_payments && membership.membership_payments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-gray-400" />
                Saved Payment Method
              </h3>
              <button
                onClick={() => navigate('/customer/membership/update-payment')}
                className="text-xs text-violet-600 hover:underline font-medium"
              >
                Update
              </button>
            </div>
            <div className="px-6 py-4">
              {membership.payment_method_label ? (
                <p className="text-sm text-gray-700 flex items-center gap-2">
                  <CreditCard size={14} className="text-gray-400" />
                  {membership.payment_method_label}
                </p>
              ) : (
                <p className="text-sm text-gray-400 italic">No payment method saved</p>
              )}
            </div>
          </div>
        )}

        {(membership.benefit_redemptions ?? []).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Ticket className="w-4 h-4 text-gray-400" /> Benefit Redemptions
              </h3>
            </div>
            <ul className="text-sm divide-y divide-gray-100 max-h-72 overflow-auto">
              {(membership.benefit_redemptions ?? []).map((r) => (
                <li key={r.id} className="px-6 py-3 flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium text-xs px-2 py-0.5 rounded bg-violet-50 text-violet-700`}>
                        {r.benefit?.label || r.benefit_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs text-gray-500">{describeRedemption(r)}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {new Date(r.created_at!).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {membership.membership_payments && membership.membership_payments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Payment history</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                    <th className="px-6 py-3 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {membership.membership_payments.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 text-gray-700">{fmt(p.charged_at || undefined)}</td>
                      <td className="px-6 py-3 text-gray-900 font-medium">{formatMembershipPrice(p.amount)}</td>
                      <td className="px-6 py-3 capitalize text-gray-700">{p.status}</td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-500">{p.transaction_id || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyMembership;
