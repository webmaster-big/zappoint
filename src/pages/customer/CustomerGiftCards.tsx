import { useState } from 'react';
import { Gift, Calendar, Copy, Check } from 'lucide-react';
import type { GiftCard, OwnedGiftCard } from '../../types/customer';

const sampleGiftCards: GiftCard[] = [
  {
    code: 'GC-50-2025',
    type: 'fixed',
    initial_value: 50,
    balance: 50,
    max_usage: 1,
    description: 'Give the gift of fun! Redeemable for any attraction or package at any Zap Zone location.',
    status: 'active',
    expiry_date: '2026-12-31',
  },
  {
    code: 'GC-BDAY-2025',
    type: 'fixed',
    initial_value: 299,
    balance: 299,
    max_usage: 1,
    description: 'Perfect for birthdays! Covers a full Birthday Bash Package for up to 10 guests.',
    status: 'active',
    expiry_date: '2026-12-31',
  },
  {
    code: 'GC-FAM-2025',
    type: 'fixed',
    initial_value: 149,
    balance: 149,
    max_usage: 1,
    description: 'Enjoy a Family Fun Package with this card. Great for family outings and celebrations.',
    status: 'active',
    expiry_date: '2026-12-31',
  },
];


// Simulated owned gift cards
const ownedGiftCards: OwnedGiftCard[] = [
  {
    code: 'GC-50-OWNED',
    type: 'fixed',
    initial_value: 50,
    balance: 20,
    max_usage: 1,
    description: 'Give the gift of fun! Redeemable for any attraction or package at any Zap Zone location.',
    status: 'active',
    expiry_date: '2026-12-31',
    redeemed: false,
  },
  {
    code: 'GC-BDAY-OWNED',
    type: 'fixed',
    initial_value: 299,
    balance: 0,
    max_usage: 1,
    description: 'Perfect for birthdays! Covers a full Birthday Bash Package for up to 10 guests.',
    status: 'redeemed',
    expiry_date: '2026-12-31',
    redeemed: true,
  },
];


const CustomerGiftCards = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'available' | 'owned'>('available');
  const [showPaymentModal, setShowPaymentModal] = useState<GiftCard | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<GiftCard | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const filteredGiftCards = sampleGiftCards.filter(card =>
    card.code.toLowerCase().includes(search.toLowerCase()) ||
    card.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-3">
              Gift Cards
            </h1>
            <p className="text-gray-600 mt-2">View, redeem, and manage your Zap Zone gift cards</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              className={`px-5 py-2 font-medium text-sm border-b-2 transition-all ${tab === 'available' ? 'border-blue-800 text-blue-800 bg-white' : 'border-transparent text-gray-500 bg-gray-100 hover:text-blue-800'}`}
              onClick={() => setTab('available')}
            >
              Available Gift Cards
            </button>
            <button
              className={`px-5 py-2 font-medium text-sm border-b-2 transition-all ${tab === 'owned' ? 'border-blue-800 text-blue-800 bg-white' : 'border-transparent text-gray-500 bg-gray-100 hover:text-blue-800'}`}
              onClick={() => setTab('owned')}
            >
              My Gift Cards
            </button>
          </div>

          {/* Tab Content */}
          {tab === 'available' && (
            <>
              {/* Search Bar */}
              <div className="bg-white p-4 border border-gray-200 mb-6">
                <input
                  type="text"
                  placeholder="Search gift cards..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-800 text-gray-900"
                />
              </div>

              {/* Gift Cards List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGiftCards.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500 text-lg">
                    No gift cards found.
                  </div>
                ) : (
                  filteredGiftCards.map(card => (
                    <div
                      key={card.code}
                      className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col cursor-pointer group"
                      onClick={() => setShowDetailsModal(card)}
                      tabIndex={0}
                      role="button"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setShowDetailsModal(card); }}
                    >
                      <div className="h-48 bg-gradient-to-br from-blue-800 to-blue-900 flex items-center justify-center relative">
                        <div className="text-center text-white">
                          <Gift className="w-12 h-12 mx-auto mb-3 opacity-80" />
                          <div className="text-3xl font-bold mb-1">
                            {card.type === 'fixed' ? `$${card.initial_value}` : `${card.initial_value}%`}
                          </div>
                          <div className="text-sm opacity-90">Gift Card</div>
                        </div>
                      </div>
                      <div className="p-5 flex-1 flex flex-col">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{card.description}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                          <Calendar size={14} />
                          <span>Expires: {card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'No expiry'}</span>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-sm text-gray-600">Click to view details</span>
                          <button
                            className="bg-blue-800 hover:bg-blue-900 text-white px-6 py-2 font-medium transition-all duration-200 hover:scale-105"
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
            </>
          )}

          {tab === 'owned' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedGiftCards.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500 text-lg">
                  You do not own any gift cards yet.
                </div>
              ) : (
                ownedGiftCards.map(card => (
                  <div key={card.code} className="bg-white border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col">
                    <div className="h-48 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center relative">
                      <div className="text-center text-white">
                        <Gift className="w-12 h-12 mx-auto mb-3 opacity-80" />
                        <div className="text-3xl font-bold mb-1">
                          {card.type === 'fixed' ? `$${card.balance}` : `${card.balance}%`}
                        </div>
                        <div className="text-sm opacity-90">Balance</div>
                      </div>
                      {card.redeemed && (
                        <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1 text-xs font-semibold flex items-center gap-1">
                          <Check size={12} /> Used
                        </div>
                      )}
                      {!card.redeemed && card.balance > 0 && (
                        <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 text-xs font-semibold">
                          Active
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3 line-clamp-2">{card.description}</h3>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Gift Card Code</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-gray-900">{card.code}</span>
                            <button
                              className="p-1 hover:bg-gray-100 transition"
                              onClick={() => handleCopyCode(card.code)}
                              title="Copy Code"
                            >
                              {copiedCode === card.code ? <Check size={14} className="text-green-600" /> : <Copy size={14} className="text-gray-400" />}
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Expires</span>
                          <span className="text-gray-900">{card.expiry_date ? new Date(card.expiry_date).toLocaleDateString() : 'No expiry'}</span>
                        </div>
                      </div>
                      <div className="mt-auto">
                        {card.balance > 0 && !card.redeemed && (
                          <div className="bg-green-50 border border-green-200 p-3 text-center">
                            <div className="text-sm text-green-700 font-medium">Available to use</div>
                          </div>
                        )}
                        {card.redeemed && (
                          <div className="bg-gray-50 border border-gray-200 p-3 text-center">
                            <div className="text-sm text-gray-600">Fully redeemed</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}


          {/* Gift Card Details Modal */}
          {showDetailsModal && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white max-w-lg w-full shadow-2xl">
                <div className="bg-gradient-to-r from-blue-800 to-blue-900 p-6 text-white">
                  <div className="flex items-center gap-3 mb-4">
                    <Gift className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">Gift Card Details</h2>
                  </div>
                  <div className="text-center py-6">
                    <div className="text-5xl font-bold mb-2">
                      {showDetailsModal.type === 'fixed' ? `$${showDetailsModal.initial_value}` : `${showDetailsModal.initial_value}%`}
                    </div>
                    <div className="text-blue-100">Zap Zone Gift Card</div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{showDetailsModal.description}</h3>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Gift Card Value</span>
                      <span className="font-semibold text-gray-900">
                        {showDetailsModal.type === 'fixed' ? `$${showDetailsModal.initial_value}` : `${showDetailsModal.initial_value}%`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Valid Until</span>
                      <span className="font-semibold text-gray-900">
                        {showDetailsModal.expiry_date ? new Date(showDetailsModal.expiry_date).toLocaleDateString() : 'No expiry'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600">Redeemable For</span>
                      <span className="font-semibold text-gray-900">Any Zap Zone Service</span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      className="flex-1 bg-blue-800 hover:bg-blue-900 text-white font-semibold py-3 transition-colors"
                      onClick={() => { setShowDetailsModal(null); setShowPaymentModal(showDetailsModal); }}
                    >
                      Purchase Now
                    </button>
                    <button
                      className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 transition-colors"
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
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
              <div className="bg-white max-w-md w-full shadow-2xl">
                <div className="bg-gradient-to-r from-blue-800 to-blue-900 p-6 text-white text-center">
                  <Gift className="w-12 h-12 mx-auto mb-3 opacity-90" />
                  <h2 className="text-2xl font-bold mb-2">Complete Purchase</h2>
                  <div className="text-3xl font-bold">
                    {showPaymentModal.type === 'fixed' ? `$${showPaymentModal.initial_value}` : `${showPaymentModal.initial_value}%`}
                  </div>
                  <div className="text-blue-100 text-sm mt-1">Zap Zone Gift Card</div>
                </div>
                <div className="p-6">
                  <form onSubmit={e => { e.preventDefault(); setShowPaymentModal(null); /* Implement payment logic here */ }}>
                    <div className="mb-4">
                      <label className="block text-gray-700 text-sm font-semibold mb-2">Card Number</label>
                      <input 
                        type="text" 
                        className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                        placeholder="1234 5678 9012 3456" 
                        required 
                        maxLength={19} 
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2">Expiry Date</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="MM/YY" 
                          required 
                          maxLength={5} 
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 text-sm font-semibold mb-2">CVC</label>
                        <input 
                          type="text" 
                          className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
                          placeholder="123" 
                          required 
                          maxLength={4} 
                        />
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-4 mb-6">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Amount</span>
                        <span className="text-xl font-bold text-gray-900">
                          {showPaymentModal.type === 'fixed' ? `$${showPaymentModal.initial_value}` : `${showPaymentModal.initial_value}%`}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button 
                        type="submit" 
                        className="w-full bg-blue-800 hover:bg-blue-900 text-white font-semibold py-3 transition-colors"
                      >
                        Complete Purchase
                      </button>
                      <button 
                        type="button" 
                        className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 transition-colors" 
                        onClick={() => setShowPaymentModal(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
  );
};

export default CustomerGiftCards;
