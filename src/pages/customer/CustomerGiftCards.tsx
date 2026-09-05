import { useState, useEffect, useCallback, useRef } from 'react';
import { Gift, Copy, Check, MapPin, CreditCard, Lock, AlertCircle } from 'lucide-react';
import {
  customerGiftCardService,
  type CustomerGiftCard,
} from '../../services/CustomerGiftCardService';
import { getAuthorizeNetPublicKey } from '../../services/SettingsService';
import { loadAcceptJS, tokenizeCard } from '../../services/PaymentService';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/storage';
import Toast from '../../components/ui/Toast';

interface LocationOption {
  id: number;
  name: string;
}

const DENOMINATIONS = [25, 50, 100, 150, 200];
const MIN_CUSTOM = 10;
const MAX_CUSTOM = 500;

const readStoredCustomer = (): { id?: number; first_name?: string; last_name?: string; email?: string } | null => {
  try {
    const stored = localStorage.getItem('zapzone_customer');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.user ?? parsed ?? null;
  } catch {
    return null;
  }
};

const CustomerGiftCards = () => {
  const [tab, setTab] = useState<'buy' | 'owned'>('buy');
  const [locations, setLocations] = useState<LocationOption[]>([]);

  const me = readStoredCustomer();
  const [amount, setAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState('');
  const [buyLocationId, setBuyLocationId] = useState<number | ''>('');
  const [purchaserName, setPurchaserName] = useState(
    [me?.first_name, me?.last_name].filter(Boolean).join(' '),
  );
  const [purchaserEmail, setPurchaserEmail] = useState(me?.email ?? '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [apiLoginId, setApiLoginId] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [gatewayReady, setGatewayReady] = useState(false);
  const [gatewayError, setGatewayError] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ code: string; initial_value: number; location: string } | null>(null);
  const [claimCode, setClaimCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const [ownedCards, setOwnedCards] = useState<CustomerGiftCard[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [ownedError, setOwnedError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };


  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const token = (() => {
          try {
            const stored = localStorage.getItem('zapzone_customer');
            if (stored) return JSON.parse(stored)?.token || null;
          } catch { /* ignore */ }
          return null;
        })();

        const res = await axios.get(`${API_BASE_URL}/locations`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (res.data?.success && Array.isArray(res.data.data)) {
          setLocations(
            res.data.data
              .filter((loc: LocationOption & { is_active?: boolean }) => loc.is_active !== false)
              .map((loc: LocationOption) => ({ id: loc.id, name: loc.name }))
          );
        }
      } catch {
      }
    };
    fetchLocations();
  }, []);

  const fetchOwnedCards = useCallback(async () => {
    try {
      setOwnedLoading(true);
      setOwnedError(null);
      const res = await customerGiftCardService.getMyGiftCards({ per_page: 50 });
      if (res.success && res.data) {
        setOwnedCards(res.data.gift_cards);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load your gift cards';
      setOwnedError(msg);
    } finally {
      setOwnedLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwnedCards();
  }, [fetchOwnedCards]);

  const handleClaim = async () => {
    const code = claimCode.trim();
    if (!code || claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await customerGiftCardService.claimGiftCard(code);
      if (res.success) {
        setClaimCode('');
        showToast('Gift card added to your account!', 'success');
        fetchOwnedCards();
      } else {
        setClaimError(res.message || 'That code could not be added.');
      }
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      setClaimError(
        err.response?.status === 429
          ? 'Too many attempts. Please wait a minute and try again.'
          : err.response?.data?.message || 'That code could not be added. Check it and try again.',
      );
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    if (buyLocationId === '' && locations.length) setBuyLocationId(locations[0].id);
  }, [locations, buyLocationId]);

  useEffect(() => {
    if (buyLocationId === '') return;
    let cancelled = false;
    setGatewayReady(false);
    setGatewayError(null);
    (async () => {
      try {
        const res = await getAuthorizeNetPublicKey(Number(buyLocationId));
        if (cancelled) return;
        if (!res?.api_login_id) {
          setGatewayError('Card payment is not set up for this location yet. Please choose another, or buy in store.');
          return;
        }
        setApiLoginId(res.api_login_id);
        setClientKey(res.client_key || res.api_login_id);
        await loadAcceptJS((res.environment as 'sandbox' | 'production') || 'sandbox');
        if (!cancelled) setGatewayReady(true);
      } catch {
        if (!cancelled) setGatewayError('We could not reach the card processor. Please try again in a moment.');
      }
    })();
    return () => { cancelled = true; };
  }, [buyLocationId]);

  const effectiveAmount = customAmount.trim() ? Number(customAmount) : amount;
  const amountValid =
    Number.isFinite(effectiveAmount) && effectiveAmount >= MIN_CUSTOM && effectiveAmount <= MAX_CUSTOM;

  const [expMonth, expYear] = (() => {
    const parts = expiry.split('/');
    const m = (parts[0] ?? '').trim();
    const y = (parts[1] ?? '').trim();
    return [m, y.length === 2 ? `20${y}` : y];
  })();

  const cardDigits = cardNumber.replace(/\D/g, '');
  const canBuy =
    gatewayReady && amountValid && !buying &&
    purchaserName.trim().length > 1 &&
    /.+@.+\..+/.test(purchaserEmail) &&
    cardDigits.length >= 13 && expMonth.length > 0 && expYear.length === 4 && cvc.length >= 3;

  const handleBuy = async () => {
    if (!canBuy || buyLocationId === '') return;
    setBuying(true);
    setBuyError(null);
    try {
      const opaque = await tokenizeCard(
        { cardNumber: cardDigits, month: expMonth, year: expYear, cardCode: cvc },
        apiLoginId,
        clientKey,
      );
      const res = await customerGiftCardService.purchaseGiftCard({
        location_id: Number(buyLocationId),
        amount: effectiveAmount,
        payment_method: 'authorize.net',
        purchaser_name: purchaserName.trim(),
        purchaser_email: purchaserEmail.trim(),
        opaque_data: { dataDescriptor: opaque.dataDescriptor, dataValue: opaque.dataValue },
      });
      if (!res.success || !res.data) {
        setBuyError(res.message || 'That purchase did not go through.');
        return;
      }
      setIssued({ code: res.data.code, initial_value: res.data.initial_value, location: res.data.location });
      setCardNumber(''); setExpiry(''); setCvc(''); setCustomAmount('');
      showToast(res.duplicate ? 'This card was already purchased.' : 'Gift card purchased!', 'success');
      fetchOwnedCards();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setBuyError(err.response?.data?.message || err.message || 'That purchase did not go through.');
    } finally {
      setBuying(false);
    }
  };


  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast('Gift card code copied!', 'success');
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const isRedeemed = (card: CustomerGiftCard) =>
    card.status === 'redeemed' || card.balance === 0;

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes backdrop-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .animate-backdrop-fade { animation: backdrop-fade 0.2s ease-out; }
        .animate-scale-in { animation: scale-in 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.4s ease-out both; }
        .card-hover { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 20px -6px rgba(0,0,0,0.08); }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; border-radius: 8px; }
        [data-tooltip] { position: relative; }
        [data-tooltip]:hover::after { content: attr(data-tooltip); position: absolute; bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); padding: 4px 10px; font-size: 11px; font-weight: 500; color: #fff; background: #1e293b; border-radius: 6px; white-space: nowrap; z-index: 50; pointer-events: none; animation: backdrop-fade 0.15s ease-out; }
        [data-tooltip]:hover::before { content: ''; position: absolute; bottom: calc(100% + 2px); left: 50%; transform: translateX(-50%); border: 4px solid transparent; border-top-color: #1e293b; z-index: 50; pointer-events: none; animation: backdrop-fade 0.15s ease-out; }
      `}</style>
      <div className="min-h-screen bg-gray-50">
        <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-6 md:py-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]"></div>
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 animate-slide-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                    <Gift className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest">Gift Cards</span>
                </div>
                <h1 className="text-xl font-bold" style={{ color: 'white' }}>Gift Cards</h1>
                <p className="text-blue-200/60 text-sm mt-0.5">View, redeem, and manage your gift cards</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">{ownedCards.length} owned</span>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex gap-2 mb-6 animate-slide-up">
            <button
              className={`px-4 py-2 font-medium text-sm rounded-full transition-all duration-200 ${tab === 'buy' ? 'bg-blue-800 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
              onClick={() => setTab('buy')}
            >
              Buy a Gift Card
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm rounded-full transition-all duration-200 ${tab === 'owned' ? 'bg-blue-800 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
              onClick={() => setTab('owned')}
            >
              My Cards
            </button>
          </div>

          {tab === 'buy' && (
            <>
              {issued && (
                <div className="bg-white border border-emerald-200 rounded-xl p-5 mb-5 animate-slide-up">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Check size={18} className="text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-gray-900">Your gift card is ready</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        ${issued.initial_value.toFixed(2)} for {issued.location}. We have emailed a copy to {purchaserEmail}.
                      </p>
                      <div className="flex items-center gap-2 mt-3">
                        <code className="font-mono text-base font-bold tracking-wider bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900">
                          {issued.code}
                        </code>
                        <button
                          onClick={() => handleCopyCode(issued.code)}
                          className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
                          title="Copy code"
                        >
                          {copiedCode === issued.code ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-gray-500" />}
                        </button>
                      </div>
                      <button onClick={() => setTab('owned')} className="text-sm font-semibold text-blue-800 hover:text-blue-900 mt-3">
                        See it in My Cards
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                <div className="lg:col-span-3 bg-white border border-gray-100 rounded-xl p-5 animate-slide-up">
                  <h2 className="text-base font-semibold text-gray-900">Choose an amount</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Gift cards never lose their balance and can be used at any Zap Zone.</p>

                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 mt-4">
                    {DENOMINATIONS.map(d => {
                      const active = !customAmount.trim() && amount === d;
                      return (
                        <button
                          key={d}
                          onClick={() => { setAmount(d); setCustomAmount(''); }}
                          className={`py-3 rounded-lg font-semibold text-sm border transition-all ${active ? 'bg-blue-800 text-white border-blue-800 shadow-sm' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400'}`}
                        >
                          ${d}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3">
                    <label className="block text-gray-700 text-sm font-medium mb-1.5">Or a custom amount</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                        placeholder={`${MIN_CUSTOM} - ${MAX_CUSTOM}`}
                        className="w-full pl-7 pr-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    {customAmount.trim() && !amountValid && (
                      <p className="text-xs text-red-600 mt-1.5">Enter an amount between ${MIN_CUSTOM} and ${MAX_CUSTOM}.</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5 pt-5 border-t border-gray-100">
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-1.5">Location</label>
                      <div className="relative">
                        <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <select
                          value={buyLocationId}
                          onChange={e => setBuyLocationId(e.target.value ? Number(e.target.value) : '')}
                          className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none"
                        >
                          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-700 text-sm font-medium mb-1.5">Your name</label>
                      <input
                        type="text"
                        value={purchaserName}
                        onChange={e => setPurchaserName(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-gray-700 text-sm font-medium mb-1.5">Email the card to</label>
                      <input
                        type="email"
                        value={purchaserEmail}
                        onChange={e => setPurchaserEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-xl p-5 animate-slide-up flex flex-col">
                  <div className="flex items-center gap-2">
                    <CreditCard size={16} className="text-gray-400" />
                    <h2 className="text-base font-semibold text-gray-900">Payment</h2>
                  </div>

                  {gatewayError ? (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex gap-2.5">
                      <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">{gatewayError}</p>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4">
                        <label className="block text-gray-700 text-sm font-medium mb-1.5">Card number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="cc-number"
                          value={cardNumber}
                          onChange={e => setCardNumber(e.target.value.replace(/[^0-9 ]/g, ''))}
                          placeholder="1234 5678 9012 3456"
                          maxLength={19}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-gray-700 text-sm font-medium mb-1.5">Expiry</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            value={expiry}
                            onChange={e => setExpiry(e.target.value.replace(/[^0-9/]/g, ''))}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-700 text-sm font-medium mb-1.5">CVC</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            value={cvc}
                            onChange={e => setCvc(e.target.value.replace(/\D/g, ''))}
                            placeholder="123"
                            maxLength={4}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex items-start gap-2 mt-3">
                        <Lock size={12} className="text-gray-400 flex-shrink-0 mt-1" />
                        <p className="text-[11px] leading-relaxed text-gray-400">
                          Your card details go straight to Authorize.Net and never touch a Zap Zone server.
                        </p>
                      </div>

                      {buyError && (
                        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2.5">
                          <AlertCircle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                          <p className="text-sm text-red-700">{buyError}</p>
                        </div>
                      )}

                      <div className="mt-auto pt-5">
                        <div className="flex justify-between items-baseline mb-3">
                          <span className="text-gray-500 text-sm">Total</span>
                          <span className="text-xl font-bold text-gray-900">
                            {amountValid ? `$${effectiveAmount.toFixed(2)}` : '--'}
                          </span>
                        </div>
                        <button
                          onClick={handleBuy}
                          disabled={!canBuy}
                          className="w-full bg-blue-800 hover:bg-blue-900 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all text-sm"
                        >
                          {buying ? 'Processing...' : !gatewayReady ? 'Loading payment...' : amountValid ? `Buy gift card - $${effectiveAmount.toFixed(2)}` : 'Choose an amount'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {tab === 'owned' && (
            <>
              <div className="bg-white border border-gray-100 rounded-xl p-4 mb-5 animate-slide-up">
                <label className="block text-sm font-semibold text-gray-900 mb-1">Add a gift card</label>
                <p className="text-xs text-gray-500 mb-3">Got a card from the front desk or as a gift? Enter its code to keep it here with its live balance.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={claimCode}
                    onChange={e => { setClaimCode(e.target.value.toUpperCase()); setClaimError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') handleClaim(); }}
                    placeholder="e.g. GC7K2M9PW4TQ3B"
                    className="flex-1 min-w-0 px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 font-mono tracking-wide text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={handleClaim}
                    disabled={claiming || !claimCode.trim()}
                    className="px-5 py-2.5 bg-blue-800 hover:bg-blue-900 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold text-sm rounded-lg transition"
                  >
                    {claiming ? 'Adding…' : 'Add card'}
                  </button>
                </div>
                {claimError && <p className="text-xs text-red-600 mt-2">{claimError}</p>}
              </div>
              {ownedLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-white border border-gray-100/80 rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="skeleton h-36 rounded-none" />
                      <div className="p-4 space-y-3">
                        <div className="skeleton h-4 w-3/4 rounded" />
                        <div className="space-y-2 pt-2.5 border-t border-gray-50">
                          <div className="skeleton h-3 w-full rounded" />
                          <div className="skeleton h-3 w-2/3 rounded" />
                        </div>
                        <div className="skeleton h-10 w-full rounded-xl" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!ownedLoading && ownedError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <p className="text-red-700 mb-3 text-sm">{ownedError}</p>
                  <button
                    onClick={fetchOwnedCards}
                    className="px-5 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!ownedLoading && !ownedError && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
              {ownedCards.length === 0 ? (
                <div className="col-span-full text-center py-14">
                  <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">No gift cards yet</h3>
                  <p className="text-gray-400 text-sm mb-5">Purchase a gift card to get started!</p>
                  <button onClick={() => setTab('buy')} className="px-5 py-2 bg-blue-800 text-white font-medium text-sm rounded-lg hover:bg-blue-900 transition">
                    Browse Gift Cards
                  </button>
                </div>
              ) : (
                ownedCards.map(card => (
                  <div key={card.id ?? card.code} className="bg-white border border-gray-100/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col card-hover animate-slide-up">
                    <div className="h-36 bg-gradient-to-br from-gray-700 via-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.07),transparent_50%)]"></div>
                      <div className="text-center text-white relative z-10">
                        <Gift className="w-9 h-9 mx-auto mb-2 opacity-80" />
                        <div className="text-2xl font-bold mb-0.5">
                          {card.type === 'fixed' ? `$${card.balance}` : `${card.balance}%`}
                        </div>
                        <div className="text-xs text-white/70 font-medium">Balance</div>
                      </div>
                      {isRedeemed(card) && (
                        <div className="absolute top-3 right-3 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1 text-xs font-semibold rounded-lg flex items-center gap-1">
                          <Check size={12} /> Used
                        </div>
                      )}
                      {!isRedeemed(card) && card.balance > 0 && (
                        <div className="absolute top-3 right-3 bg-emerald-500/90 backdrop-blur-sm text-white px-3 py-1 text-xs font-semibold rounded-lg">
                          Active
                        </div>
                      )}
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="text-base font-semibold text-gray-900 mb-2.5 line-clamp-2">{card.description}</h3>
                      <div className="space-y-2 mb-3 pt-2.5 border-t border-gray-50">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 font-medium">Gift Card Code</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg text-xs">{card.code}</span>
                            <button
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                              onClick={() => handleCopyCode(card.code)}
                              data-tooltip="Copy code"
                            >
                              {copiedCode === card.code ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-400" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-400 font-medium">Expires</span>
                          <span className="text-gray-900">{card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'No expiry'}</span>
                        </div>
                      </div>
                      <div className="mt-auto">
                        {card.balance > 0 && !isRedeemed(card) && (
                          <div className="bg-emerald-50 border border-emerald-200 p-3 text-center rounded-xl">
                            <div className="text-sm text-emerald-700 font-semibold">Available to use</div>
                          </div>
                        )}
                        {isRedeemed(card) && (
                          <div className="bg-gray-50 border border-gray-200 p-3 text-center rounded-xl">
                            <div className="text-sm text-gray-500 font-medium">Fully redeemed</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
              )}
            </>
          )}




        </div>
      </div>

    </>
  );
};

export default CustomerGiftCards;
