import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Calendar, Copy, Check, MapPin, X, Construction } from 'lucide-react';
import {
  customerGiftCardService,
  type CustomerGiftCard,
} from '../../services/CustomerGiftCardService';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/storage';
import Toast from '../../components/ui/Toast';

// Minimal location type for the filter dropdown
interface LocationOption {
  id: number;
  name: string;
}

const CustomerGiftCards = () => {
  // ── State ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'available' | 'owned'>('available');
  const [search, setSearch] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState<number | ''>('');
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const navigate = useNavigate();

  // Check if on production domain
  useEffect(() => {
    if (window.location.hostname === 'booking.zap-zone.com') {
      setShowComingSoon(true);
    }
  }, []);

  // Available cards
  const [availableCards, setAvailableCards] = useState<CustomerGiftCard[]>([]);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [availableError, setAvailableError] = useState<string | null>(null);

  // Owned cards
  const [ownedCards, setOwnedCards] = useState<CustomerGiftCard[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [ownedError, setOwnedError] = useState<string | null>(null);

  // Modals
  const [showPaymentModal, setShowPaymentModal] = useState<CustomerGiftCard | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<CustomerGiftCard | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ message, type });
    toastTimeout.current = setTimeout(() => setToast(null), 3000);
  };

  // ── Data loading ───────────────────────────────────────────────────

  // Fetch available locations for the filter dropdown
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
        // Silently fail — location filter just won't appear
      }
    };
    fetchLocations();
  }, []);

  const fetchAvailableCards = useCallback(async () => {
    try {
      setAvailableLoading(true);
      setAvailableError(null);
      const res = await customerGiftCardService.getAvailableGiftCards({
        search: search || undefined,
        location_id: selectedLocationId || undefined,
        per_page: 50,
      });
      if (res.success && res.data) {
        setAvailableCards(res.data.gift_cards);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load gift cards';
      setAvailableError(msg);
    } finally {
      setAvailableLoading(false);
    }
  }, [search, selectedLocationId]);

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

  // Fetch available on mount & search change (debounced)
  useEffect(() => {
    const id = setTimeout(() => fetchAvailableCards(), 400);
    return () => clearTimeout(id);
  }, [fetchAvailableCards]);

  // Fetch owned once
  useEffect(() => {
    fetchOwnedCards();
  }, [fetchOwnedCards]);

  // ── Helpers ────────────────────────────────────────────────────────

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
        {/* Hero Header */}
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
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">{availableCards.length} available</span>
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">{ownedCards.length} owned</span>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 animate-slide-up">
            <button
              className={`px-4 py-2 font-medium text-sm rounded-full transition-all duration-200 ${tab === 'available' ? 'bg-blue-800 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
              onClick={() => setTab('available')}
            >
              Available
            </button>
            <button
              className={`px-4 py-2 font-medium text-sm rounded-full transition-all duration-200 ${tab === 'owned' ? 'bg-blue-800 text-white shadow-sm' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
              onClick={() => setTab('owned')}
            >
              My Cards
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'available' && (
            <>
              {/* Search Bar & Location Filter */}
              <div className="bg-white p-3.5 rounded-xl border border-gray-100/80 shadow-sm mb-6 animate-slide-up">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    placeholder="Search gift cards..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 px-3.5 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-gray-900 bg-gray-50 text-sm"
                  />
                  {locations.length > 0 && (
                    <div className="relative sm:w-52">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      <select
                        value={selectedLocationId}
                        onChange={e => setSelectedLocationId(e.target.value ? Number(e.target.value) : '')}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-800 text-gray-900 appearance-none bg-gray-50 text-sm"
                      >
                        <option value="">All Locations</option>
                        {locations.map(loc => (
                          <option key={loc.id} value={loc.id}>{loc.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Loading Skeleton */}
              {availableLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-white border border-gray-100/80 rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                      <div className="skeleton h-36 rounded-none" />
                      <div className="p-4 space-y-3">
                        <div className="skeleton h-4 w-3/4 rounded" />
                        <div className="skeleton h-3 w-1/2 rounded" />
                        <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                          <div className="skeleton h-3 w-20 rounded" />
                          <div className="skeleton h-8 w-20 rounded-lg" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Error */}
              {!availableLoading && availableError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                  <p className="text-red-700 mb-3 text-sm">{availableError}</p>
                  <button
                    onClick={fetchAvailableCards}
                    className="px-5 py-2 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Gift Cards List */}
              {!availableLoading && !availableError && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                  {availableCards.length === 0 ? (
                    <div className="col-span-full text-center py-16">
                      <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No gift cards found</h3>
                      <p className="text-gray-500">Try adjusting your search or location filter.</p>
                    </div>
                  ) : (
                    availableCards.map(card => (
                    <div
                      key={card.code}
                      className="bg-white border border-gray-100/80 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col cursor-pointer group card-hover animate-slide-up"
                      onClick={() => setShowDetailsModal(card)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowDetailsModal(card); }}
                    >
                      <div className="h-36 bg-gradient-to-br from-blue-800 via-blue-700 to-blue-600 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_50%)]"></div>
                        <div className="text-center text-white relative z-10">
                          <Gift className="w-9 h-9 mx-auto mb-2 opacity-80 group-hover:scale-110 transition-transform duration-300" />
                          <div className="text-2xl font-bold mb-0.5">
                            {card.type === 'fixed' ? `$${card.initial_value}` : `${card.initial_value}%`}
                          </div>
                          <div className="text-xs text-white/70 font-medium">Gift Card</div>
                        </div>
                      </div>
                      <div className="p-4 flex-1 flex flex-col">
                        <h3 className="text-base font-semibold text-gray-900 mb-1.5 line-clamp-2 group-hover:text-blue-800 transition-colors">{card.description}</h3>
                        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-4">
                          <Calendar size={13} />
                          <span>Expires: {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'No expiry'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                          <span className="text-xs text-gray-400">Click for details</span>
                          <button
                            className="bg-blue-800 hover:bg-blue-900 text-white px-4 py-1.5 font-medium text-sm rounded-lg transition-all duration-200"
                            onClick={e => { e.stopPropagation(); setShowPaymentModal(card); }}
                          >
                            Buy Now
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              )}
            </>
          )}

          {tab === 'owned' && (
            <>
              {/* Loading Skeleton */}
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

              {/* Error */}
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
                  <button onClick={() => setTab('available')} className="px-5 py-2 bg-blue-800 text-white font-medium text-sm rounded-lg hover:bg-blue-900 transition">
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


          {/* Gift Card Details Modal */}
          {showDetailsModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowDetailsModal(null)}>
              <div className="rounded-xl max-w-lg w-full shadow-2xl animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 p-5 text-white relative">
                    <div className="flex items-center justify-between mb-4">
                    <button
                    onClick={() => setShowDetailsModal(null)}
                    className="absolute top-3 right-3 p-1.5 hover:bg-white/15 rounded-lg transition text-white"
                  >
                    <X size={16} />
                  </button>
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4" />
                      <h2 className="text-base font-semibold" style={{ color: 'white' }}>Gift Card Details</h2>
                    </div>
                    <div className="text-center py-4">
                      <div className="text-4xl font-bold mb-1">
                        {showDetailsModal.type === 'fixed' ? `$${showDetailsModal.initial_value}` : `${showDetailsModal.initial_value}%`}
                      </div>
                      <div className="text-blue-200/80 text-sm">Zap Zone Gift Card</div>
                    </div>
                  </div>
                </div>
                <div className="p-5 bg-white">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">{showDetailsModal.description}</h3>
                  
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Value</span>
                      <span className="font-bold text-gray-900">
                        {showDetailsModal.type === 'fixed' ? `$${showDetailsModal.initial_value}` : `${showDetailsModal.initial_value}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Valid Until</span>
                      <span className="font-semibold text-gray-900 text-sm">
                        {showDetailsModal.expiry_date ? new Date(showDetailsModal.expiry_date).toLocaleDateString() : 'No expiry'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Redeemable For</span>
                      <span className="font-semibold text-gray-900 text-sm">Any Zap Zone Service</span>
                    </div>
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      className="flex-1 bg-blue-800 hover:bg-blue-900 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
                      onClick={() => { setShowDetailsModal(null); setShowPaymentModal(showDetailsModal); }}
                    >
                      Purchase Now
                    </button>
                    <button
                      className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-600 font-medium py-2.5 rounded-lg transition-colors text-sm"
                      onClick={() => setShowDetailsModal(null)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Payment Modal */}
          {showPaymentModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-backdrop-fade" onClick={() => setShowPaymentModal(null)}>
              <div className="rounded-xl max-w-md w-full shadow-2xl animate-scale-in overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-5 py-4 text-white text-center relative">
                  <button
                    onClick={() => setShowPaymentModal(null)}
                    className="absolute top-3 right-3 p-1.5 hover:bg-white/15 rounded-lg transition text-white"
                  >
                    <X size={16} />
                  </button>
                  <Gift className="w-9 h-9 mx-auto mb-2 opacity-90" />
                  <h2 className="text-base font-semibold mb-1" style={{ color: 'white' }}>Complete Purchase</h2>
                  <div className="text-2xl font-bold">
                    {showPaymentModal.type === 'fixed' ? `$${showPaymentModal.initial_value}` : `${showPaymentModal.initial_value}%`}
                  </div>
                  <div className="text-blue-200/80 text-sm mt-0.5">Zap Zone Gift Card</div>
                </div>
                <div className="p-5 bg-white">
                  <form onSubmit={e => { e.preventDefault(); setShowPaymentModal(null); /* Implement payment logic here */ }}>
                    <div className="mb-3">
                      <label className="block text-gray-700 text-sm font-medium mb-1.5">Card Number</label>
                      <input 
                        type="text" 
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                        placeholder="1234 5678 9012 3456" 
                        required 
                        maxLength={19} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-1.5">Expiry Date</label>
                        <input 
                          type="text" 
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                          placeholder="MM/YY" 
                          required 
                          maxLength={5} 
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-medium mb-1.5">CVC</label>
                        <input 
                          type="text" 
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" 
                          placeholder="123" 
                          required 
                          maxLength={4} 
                        />
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3.5 rounded-lg mb-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 text-sm">Total</span>
                        <span className="text-lg font-bold text-gray-900">
                          {showPaymentModal.type === 'fixed' ? `$${showPaymentModal.initial_value}` : `${showPaymentModal.initial_value}%`}
                        </span>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-blue-800 hover:bg-blue-900 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
                    >
                      Complete Purchase
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Coming Soon Popup - only on production */}
      {showComingSoon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-backdrop-fade">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-700 px-6 py-5 text-center">
              <Construction className="w-10 h-10 mx-auto mb-2" strokeWidth={2} style={{ color: 'white' }} />
              <h2 className="text-lg font-bold" style={{ color: 'white' }}>Coming Soon</h2>
            </div>
            <div className="p-6 text-center">
              <p className="text-gray-600 text-sm mb-5">This feature is currently under development and not yet available. Stay tuned for updates!</p>
              <button
                onClick={() => { setShowComingSoon(false); navigate('/'); }}
                className="w-full bg-blue-800 hover:bg-blue-900 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CustomerGiftCards;