import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CreditCard,
  Crown,
  ShieldCheck,
  AlertCircle,
  ArrowLeft,
  Lock,
} from 'lucide-react';
import membershipService from '../../services/MembershipService';
import { membershipCache } from '../../services/MembershipCacheService';
import { loadAcceptJS, tokenizeCard } from '../../services/PaymentService';
import { getAuthorizeNetPublicKey } from '../../services/SettingsService';
import locationService from '../../services/LocationService';
import type { Membership } from '../../types/Membership.types';
import Toast from '../../components/ui/Toast';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import StandardButton from '../../components/ui/StandardButton';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { useToast } from '../../hooks/useToast';
import { useThemeColor } from '../../hooks/useThemeColor';

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

const UpdatePaymentMethod = () => {
  const navigate = useNavigate();
  const { themeColor } = useThemeColor();
  const { toast, show, showSuccess, showError, clear } = useToast();

  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');

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
      try {
        const m = await membershipCache.getMine();
        setMembership(m);
        if (m) {
          try {
            const locs = await locationService.getLocations({ is_active: true, per_page: 100 });
            const loc = m.home_location_id
              ? (locs.data ?? []).find((l) => l.id === m.home_location_id) ?? (locs.data ?? [])[0]
              : (locs.data ?? [])[0];
            if (loc) {
              const res = await getAuthorizeNetPublicKey(loc.id);
              if (res?.api_login_id) {
                setApiLoginId(res.api_login_id);
                setClientKey(res.client_key || res.api_login_id);
                await loadAcceptJS((res.environment as 'sandbox' | 'production') || 'sandbox');
              }
            }
          } catch {
            // Auth.Net may not be configured — continue without it
          }
        }
      } catch (e: unknown) {
        showError(e, 'Failed to load membership');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardDigits = cardNumber.replace(/\s+/g, '');
  const cardType = detectCardType(cardNumber);

  const [expMonth, expYear] = useMemo(() => {
    const parts = expiry.split('/');
    const m = (parts[0] ?? '').trim();
    const y = (parts[1] ?? '').trim();
    const fullYear = y.length === 2 ? `20${y}` : y;
    return [m, fullYear];
  }, [expiry]);

  const canSubmit =
    !!membership &&
    cardDigits.length >= 13 &&
    expiry.includes('/') &&
    cvc.length >= 3;

  const validatePayment = () => {
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

  const handleSubmit = async () => {
    if (!canSubmit || !membership) return;
    if (!validatePayment()) return;
    if (!apiLoginId) {
      show('Payment system not ready. Try again in a moment.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const opaque = await tokenizeCard(
        { cardNumber: cardDigits, month: expMonth, year: expYear, cardCode: cvc },
        apiLoginId,
        clientKey,
      );
      const last4 = cardDigits.slice(-4);
      const label = nameOnCard
        ? `${nameOnCard} · Card ending ${last4}`
        : `Card ending ${last4}`;
      await membershipService.updatePaymentMethod(membership.id, {
        payment_method_label: label,
        opaque_data: { dataDescriptor: opaque.dataDescriptor, dataValue: opaque.dataValue },
      });
      showSuccess('Payment method updated!');
      await membershipCache.invalidate('mine');
      setTimeout(() => navigate('/customer/membership'), 800);
    } catch (e: unknown) {
      showError(e, 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen size="medium" message="Loading…" />;
  }

  if (!membership) {
    return (
      <div className="min-h-screen bg-gray-50/80 flex items-center justify-center">
        <div className="text-center px-4">
          <p className="text-gray-500 mb-4">No active membership found.</p>
          <StandardButton variant="secondary" onClick={() => navigate('/customer/membership/purchase')}>
            Get a Membership
          </StandardButton>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/80">
      {toast && <Toast message={toast.message} type={toast.type} onClose={clear} />}

      <section className={`relative bg-gradient-to-br from-${themeColor}-900 via-${themeColor}-800 to-${themeColor}-700 text-white py-6 md:py-8 overflow-hidden`}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto px-4 sm:px-6">
          <button
            onClick={() => navigate('/customer/membership')}
            className={`flex items-center gap-1 text-${themeColor}-200/70 hover:text-white text-xs mb-3 transition`}
          >
            <ArrowLeft size={13} /> Back to membership
          </button>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
              <Crown className="w-3.5 h-3.5" />
            </div>
            <span className={`text-${themeColor}-200/70 text-xs font-semibold uppercase tracking-widest`}>Membership</span>
          </div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard className={`w-5 h-5 text-${themeColor}-200`} /> Update Payment Method
          </h1>
          <p className={`text-${themeColor}-200/60 text-sm mt-0.5`}>Replace the card used for future membership renewals.</p>
        </div>
      </section>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {membership.payment_method_label && (
          <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <CreditCard size={18} className="text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-xs uppercase text-gray-500">Current payment method</p>
              <p className="text-sm font-medium text-gray-800">{membership.payment_method_label}</p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
              <CreditCard className={`w-4 h-4 text-${themeColor}-600`} /> New Card
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

          <div className="px-5 py-4">
            <StandardButton
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="w-full"
            >
              {submitting ? 'Saving…' : (
                <span className="flex items-center justify-center gap-2">
                  <Lock size={14} /> Save New Card
                </span>
              )}
            </StandardButton>
            <p className="text-[10px] text-gray-400 text-center mt-2 flex items-center justify-center gap-1">
              <ShieldCheck size={11} className="text-gray-400" /> Secure · Powered by Authorize.Net
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdatePaymentMethod;
