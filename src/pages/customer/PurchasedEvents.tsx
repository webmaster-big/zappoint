import { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Eye,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  DollarSign,
  Search,
  ArrowUpDown,
  AlertCircle,
  Ticket,
  Users,
} from 'lucide-react';
import { eventPurchaseService } from '../../services/EventPurchaseService';
import { getImageUrl } from '../../utils/storage';
import Toast from '../../components/ui/Toast';
import Pagination from '../../components/ui/Pagination';
import type { EventPurchase } from '../../types/event.types';

const PurchasedEvents = () => {
  const [purchases, setPurchases] = useState<EventPurchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<EventPurchase | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const customerData = (() => {
    try {
      const data = localStorage.getItem('zapzone_customer');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    fetchPurchases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, sortOrder, searchTerm]);

  const fetchPurchases = async () => {
    if (!customerData?.id) {
      setError('Please log in to view your event tickets');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, unknown> = {
        page: currentPage,
        per_page: 10,
        sort_order: sortOrder,
      };
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (searchTerm) filters.search = searchTerm;

      const res = await eventPurchaseService.getCustomerPurchases(customerData.id, filters);
      const resData = res as unknown as Record<string, unknown>;
      const list = (Array.isArray(res.data) ? res.data : (resData.purchases || [])) as EventPurchase[];
      setPurchases(list);
      const pagination = resData.pagination as Record<string, number> | undefined;
      setTotalPages(pagination?.last_page || 1);
      setTotalItems(pagination?.total || list.length);
    } catch {
      setError('Failed to load your event tickets');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d + (d.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const formatTime = (t: string) => {
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
      case 'completed': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'checked_in': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'cancelled': return 'bg-red-500';
      case 'completed': return 'bg-blue-500';
      case 'checked_in': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.25s ease-out; }
        .slide-up { animation: slideUp 0.35s ease-out both; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .skeleton { background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 800px 100%; animation: shimmer 1.5s infinite linear; border-radius: 8px; }
        @keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
      `}</style>

      <div className="min-h-screen bg-gray-50/80">
        {/* Hero */}
        <section className="relative bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-6 md:py-8 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06),transparent_60%)]" />
          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 slide-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="p-1.5 bg-white/10 backdrop-blur rounded-lg border border-white/10">
                    <Ticket className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-blue-200/70 text-xs font-semibold uppercase tracking-widest">Event Tickets</span>
                </div>
                <h1 className="text-xl font-bold" style={{ color: 'white' }}>My Events</h1>
                <p className="text-blue-200/60 text-sm mt-0.5">View and manage your event tickets</p>
              </div>
              {totalItems > 0 && (
                <span className="text-xs font-medium bg-white/10 border border-white/10 backdrop-blur px-3 py-1 rounded-full text-blue-100">
                  {totalItems} total
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Main */}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Search & Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 slide-up">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex-1 relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by reference, event name..."
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                  title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setSearchTerm(''); setStatusFilter('all'); setSortOrder('desc'); setCurrentPage(1); }}
                  className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
                  title="Reset filters"
                >
                  <RefreshCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100 overflow-x-auto no-scrollbar">
              {[
                { key: 'all', label: 'All' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'pending', label: 'Pending' },
                { key: 'completed', label: 'Completed' },
                { key: 'checked_in', label: 'Checked In' },
                { key: 'cancelled', label: 'Cancelled' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setStatusFilter(tab.key); setCurrentPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all ${
                    statusFilter === tab.key ? 'bg-blue-700 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 slide-up" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-5 w-44" />
                      <div className="skeleton h-5 w-20 rounded-full" />
                    </div>
                    <div className="flex gap-4">
                      <div className="skeleton h-4 w-24" />
                      <div className="skeleton h-4 w-36" />
                      <div className="skeleton h-4 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-red-100 p-5 mb-5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Unable to load tickets</p>
                <p className="text-sm text-gray-500 mt-0.5">{error}</p>
                <button onClick={() => { setError(null); fetchPurchases(); }} className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-800 transition">
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* Cards */}
          {!loading && !error && (
            <div className="space-y-3">
              {purchases.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="inline-flex p-4 rounded-full bg-blue-50 mb-4">
                    <Ticket className="w-10 h-10 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">No event tickets found</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    {statusFilter !== 'all' ? `No ${statusFilter} tickets to show` : 'Purchase tickets to an upcoming event'}
                  </p>
                  {statusFilter !== 'all' ? (
                    <button
                      onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
                      className="inline-flex items-center text-sm px-5 py-2 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition"
                    >
                      Clear Filter
                    </button>
                  ) : (
                    <a
                      href="/"
                      className="inline-flex items-center text-sm px-5 py-2 bg-blue-700 text-white font-medium rounded-lg hover:bg-blue-800 transition"
                    >
                      Explore Events
                    </a>
                  )}
                </div>
              ) : (
                purchases.map((purchase, idx) => (
                  <div
                    key={purchase.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow slide-up"
                    style={{ animationDelay: `${idx * 0.04}s` }}
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        {/* Thumbnail */}
                        {purchase.event?.image && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                            <img
                              src={getImageUrl(purchase.event.image)}
                              alt={purchase.event.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5 mb-2">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {purchase.event?.name || 'Event'}
                            </h3>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full ${getStatusColor(purchase.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(purchase.status)}`} />
                              {purchase.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500">
                            {purchase.event?.location && (
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin size={13} className="text-gray-400" />
                                {purchase.event.location.name}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1.5">
                              <Calendar size={13} className="text-gray-400" />
                              {formatDate(purchase.purchase_date)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock size={13} className="text-gray-400" />
                              {formatTime(purchase.purchase_time)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users size={13} className="text-gray-400" />
                              {purchase.quantity} ticket{purchase.quantity > 1 ? 's' : ''}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-gray-900">
                              <DollarSign size={13} className="text-emerald-500" />
                              {parseFloat(String(purchase.total_amount)).toFixed(2)}
                            </span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(purchase.payment_status)}`}>
                              {purchase.payment_status}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => { setSelectedPurchase(purchase); setShowDetailsModal(true); }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expand Toggle */}
                    <button
                      onClick={() => setExpandedId(expandedId === purchase.id ? null : purchase.id)}
                      className="w-full flex items-center justify-between px-5 py-2.5 bg-gray-50 hover:bg-gray-100 transition text-sm border-t border-gray-100"
                    >
                      <span className="font-medium text-gray-500">
                        {expandedId === purchase.id ? 'Hide details' : 'More details'}
                      </span>
                      {expandedId === purchase.id ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    </button>

                    {/* Expanded */}
                    {expandedId === purchase.id && (
                      <div className="p-4 sm:p-5 bg-gray-50/50 fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Ticket Info</h4>
                            <div className="space-y-2.5 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Reference</span>
                                <span className="font-mono font-semibold text-gray-800 bg-gray-50 px-2 py-0.5 rounded text-xs">{purchase.reference_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Quantity</span>
                                <span className="text-gray-700">{purchase.quantity}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Total</span>
                                <span className="font-semibold text-gray-900">${parseFloat(String(purchase.total_amount)).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-gray-500">Payment</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(purchase.payment_status)}`}>
                                  {purchase.payment_status}
                                </span>
                              </div>
                              {purchase.special_requests && (
                                <div className="pt-2 border-t border-gray-100">
                                  <span className="text-gray-500 block mb-1">Special Requests</span>
                                  <p className="text-gray-700 text-sm">{purchase.special_requests}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Add-ons */}
                          {purchase.add_ons && purchase.add_ons.length > 0 && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                              <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Add-Ons</h4>
                              <div className="space-y-2">
                                {purchase.add_ons.map(addon => (
                                  <div key={addon.id} className="flex justify-between text-sm">
                                    <span className="text-gray-600">
                                      {addon.name}
                                      {addon.pivot?.quantity && addon.pivot.quantity > 1 && (
                                        <span className="text-gray-400 ml-1">×{addon.pivot.quantity}</span>
                                      )}
                                    </span>
                                    <span className="text-gray-700 font-medium">
                                      ${addon.pivot?.price_at_purchase
                                        ? (parseFloat(String(addon.pivot.price_at_purchase)) * (addon.pivot.quantity || 1)).toFixed(2)
                                        : parseFloat(String(addon.price)).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Event Features */}
                          {purchase.event?.features && purchase.event.features.length > 0 && (
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 md:col-span-2">
                              <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Event Includes</h4>
                              <div className="flex flex-wrap gap-2">
                                {purchase.event.features.map((f, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
                                    ✓ {f}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && totalPages > 1 && (
            <div className="mt-6">
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 fade-in" onClick={() => setShowDetailsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">Ticket Details</h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Event Info */}
              <div>
                <div className="flex items-start gap-4">
                  {selectedPurchase.event?.image && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={getImageUrl(selectedPurchase.event.image)}
                        alt={selectedPurchase.event.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{selectedPurchase.event?.name || 'Event'}</h3>
                    {selectedPurchase.event?.location && (
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                        <MapPin size={13} /> {selectedPurchase.event.location.name}
                      </p>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full mt-2 ${getStatusColor(selectedPurchase.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedPurchase.status)}`} />
                      {selectedPurchase.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Reference</span>
                  <span className="font-mono font-semibold text-gray-800">{selectedPurchase.reference_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-800">{formatDate(selectedPurchase.purchase_date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="text-gray-800">{formatTime(selectedPurchase.purchase_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tickets</span>
                  <span className="text-gray-800">{selectedPurchase.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Guest Name</span>
                  <span className="text-gray-800">{selectedPurchase.guest_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email</span>
                  <span className="text-gray-800">{selectedPurchase.guest_email}</span>
                </div>
                {selectedPurchase.guest_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phone</span>
                    <span className="text-gray-800">{selectedPurchase.guest_phone}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="text-gray-500">Payment Method</span>
                  <span className="text-gray-800 capitalize">{selectedPurchase.payment_method?.replace('_', ' ') || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Status</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getStatusColor(selectedPurchase.payment_status)}`}>
                    {selectedPurchase.payment_status}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-lg text-blue-600">${parseFloat(String(selectedPurchase.total_amount)).toFixed(2)}</span>
                </div>
              </div>

              {/* Add-ons */}
              {selectedPurchase.add_ons && selectedPurchase.add_ons.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Add-Ons</h4>
                  <div className="space-y-2">
                    {selectedPurchase.add_ons.map(addon => (
                      <div key={addon.id} className="flex justify-between bg-gray-50 px-3 py-2 rounded-lg text-sm">
                        <span className="text-gray-600">
                          {addon.name}
                          {addon.pivot?.quantity && addon.pivot.quantity > 1 && <span className="text-gray-400 ml-1">×{addon.pivot.quantity}</span>}
                        </span>
                        <span className="font-medium text-gray-700">
                          ${addon.pivot?.price_at_purchase
                            ? (parseFloat(String(addon.pivot.price_at_purchase)) * (addon.pivot.quantity || 1)).toFixed(2)
                            : parseFloat(String(addon.price)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Special Requests */}
              {selectedPurchase.special_requests && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Special Requests</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{selectedPurchase.special_requests}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PurchasedEvents;
